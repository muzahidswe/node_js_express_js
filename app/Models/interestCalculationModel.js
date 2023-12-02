const knex = require('../config/database')
const { sendApiResult, getSettingsValue } = require('../controllers/helperController');
var moment = require('moment');
let calculation = function () { }

calculation.calculateDailyInterestForSys = function (req) { 
    return new Promise(async (resolve, reject) => {
        try {
            const penalty_days = await getSettingsValue('penalty_days');
            const disbursements = await knex("cr_credit_disbursements")
                .whereNot("due_amount", 0)
                .where("activation_status", "Active");
            if (disbursements.length > 0) {
                var updates_to_be_done = {};
                var credit_disbursement_update = {};
                var credit_disbursement_total_due_update = {};
                var credit_disbursement_total_due_interest_update = {};
                var retail_limit_update = {};
                var disbursement_wise_interest_update = {};
                var disbursement_wise_interest_total_update = {};
                for (let i = 0; i < disbursements.length; i++) {
                    const e = disbursements[i];
                    let disbursement_wise_interests = await knex("cr_disbursement_wise_interest")
                                                            .where("id_cr_credit_disbursement", e.id)
                                                            .where("is_current_transaction", 1);
                   
                    for (let j = 0; j < disbursement_wise_interests.length; j++) {
                        const element = disbursement_wise_interests[j];
                        disbursement_wise_interest_update[element.id] = {
                            sys_total_days : knex.raw(`DATEDIFF( NOW(), (SELECT cr_credit_disbursements.sys_date FROM cr_credit_disbursements WHERE cr_credit_disbursements.id = cr_disbursement_wise_interest.id_cr_credit_disbursement))`),
                            sys_effective_days : knex.raw(`DATEDIFF( NOW(), created_at)`),
                            sys_interest_amount : knex.raw(`due_amount * (interest_rate_percentage / 100) * (sys_effective_days)`),
                            sys_service_charge_amount : knex.raw(`due_amount * (service_charge_rate_percentage / 100) * (sys_effective_days)`),
                            sys_penalty_days : knex.raw(`GREATEST(0, (sys_total_days - ${penalty_days}))`),
                            sys_penalty_amount : knex.raw(`due_amount * (penalty_rate_percentage / 100) * sys_penalty_days`),
                            is_penalty_interest :  knex.raw(`LEAST(1, sys_penalty_days)`)
                        }
                        disbursement_wise_interest_total_update[element.id] = {
                            total_sys_interest_amount: knex.raw(`(sys_interest_amount + sys_service_charge_amount + sys_penalty_amount)`)
                        }
						
						// added by muzahid || to calculate day wise interest amount
						await daily_outstanding_log_sys(disbursements[i], disbursement_wise_interests[j]);
                    }
                    credit_disbursement_update[e.id] = {
                        total_interest_amount : knex.raw(`(SELECT
                                                            IFNULL(sum( total_sys_interest_amount),0) as total_sys_interest_amount
                                                        FROM
                                                            cr_disbursement_wise_interest 
                                                        WHERE
                                                            id_cr_credit_disbursement = cr_credit_disbursements.id 
                                                            )`)//#AND is_current_transaction = 1
                        //due_amount : knex.raw(`due_amount + (select sum((due_amount * (interest_rate_percentage / 100) * 1) + (due_amount * (service_charge_rate_percentage / 100) * 1) + (due_amount * (penalty_rate_percentage / 100) * 1 * is_penalty_interest)) from cr_disbursement_wise_interest where id_cr_credit_disbursement = cr_credit_disbursements.id)`),
                    }
                    credit_disbursement_total_due_interest_update[e.id] = {
                        due_interest_amount : knex.raw(`total_interest_amount - total_paid_interest_amount`)
                    }
                    credit_disbursement_total_due_update[e.id] = {
                        total_due_amount : knex.raw(`credit_amount + due_interest_amount`)
                    }
                    retail_limit_update[e.id_outlet] = {
                        current_balance : knex.raw(`allowed_limit - (select sum(due_amount + total_interest_amount - total_paid_interest_amount) from cr_credit_disbursements where id_outlet = cr_retail_limit.id_outlet)`),
                        total_interest_due: knex.raw(`(select sum(total_interest_amount - total_paid_interest_amount) from cr_credit_disbursements where id_outlet = cr_retail_limit.id_outlet)`),
                        total_due : knex.raw(`(select sum(due_amount + total_interest_amount - total_paid_interest_amount) from cr_credit_disbursements where id_outlet = cr_retail_limit.id_outlet)`)
                    }
                }
                updates_to_be_done["disbursement_wise_interest_update"] = disbursement_wise_interest_update;
                updates_to_be_done["disbursement_wise_interest_total_update"] = disbursement_wise_interest_total_update;
                updates_to_be_done["credit_disbursement_update"] = credit_disbursement_update;
                updates_to_be_done["credit_disbursement_total_due_update"] = credit_disbursement_total_due_update;
                updates_to_be_done["credit_disbursement_total_due_interest_update"] = credit_disbursement_total_due_interest_update;
                updates_to_be_done["retail_limit_update"] = retail_limit_update;

                var batchUpdate = await batchUpdates(updates_to_be_done, 'sys');
                if(batchUpdate ==0 ) throw new Error("Job not Done");
                await calculateMinimumDue();
                insertLog('sys', 'Job Complete');
                resolve(sendApiResult(true,"Job Complete"));
            }else{
                insertLog('sys', 'No data');
                resolve(sendApiResult(true,"No data"));
            }            
        } catch (error) {
            console.log(error.message)
            insertLog('sys', error.message);
            reject(sendApiResult(false, error.message))
        }      
    });
}

const daily_outstanding_log_sys = async function (disbursements, disbursement_wise_interests) {
	const interest_daily = {
		'id_cr_credit_disbursement' : disbursements.id,
		'id_outlet' : disbursements.id_outlet,
		'outlet_code' : disbursements.outlet_code,
		'sys_total_days' : parseInt(disbursement_wise_interests.sys_total_days + 1),
		'sys_effective_days' : parseInt(disbursement_wise_interests.sys_effective_days + 1),
		'sys_date' : moment(new Date()).subtract(1, 'day').format('YYYY-MM-DD'),
		'credit_amount' : disbursement_wise_interests.due_amount,
		'interest_rate' : disbursement_wise_interests.service_charge_rate_percentage,
		'principle_outstanding' : parseFloat(disbursement_wise_interests.due_amount).toFixed(2),
		'daywize_interest' : parseFloat((1 * disbursement_wise_interests.due_amount * disbursement_wise_interests.service_charge_rate_percentage) / 100).toFixed(2),
		'interest_outstanding' : parseFloat((parseInt(disbursement_wise_interests.sys_effective_days + 1) * disbursement_wise_interests.due_amount * disbursement_wise_interests.service_charge_rate_percentage) / 100).toFixed(2),		
		'daywize_total' : parseFloat(disbursement_wise_interests.due_amount + (1 * disbursement_wise_interests.due_amount * disbursement_wise_interests.service_charge_rate_percentage) / 100).toFixed(2),
		'total_outstanding' : parseFloat(disbursement_wise_interests.due_amount + (parseInt(disbursement_wise_interests.sys_effective_days + 1) * disbursement_wise_interests.due_amount * disbursement_wise_interests.service_charge_rate_percentage) / 100).toFixed(2)
	}
	await knex("cr_disbursement_wise_interest_daily_sys").insert(interest_daily);
}

const insertLog = async function(type, comment) {
    var insert_obj = {};
    insert_obj[`${type}_cron_job_done`] =  knex.raw(`NOW()`);
    insert_obj['comment'] = comment;
    const column = `${type}_cron_job_done`;
    await knex("cr_cron_job_log").insert(insert_obj);
}

const calculateMinimumDue = async function () { 
    const creditLimits = await knex("cr_retail_limit")
                            .where("activation_status", "Active")
                            .where("limit_status", "FI Confirmed");
    
    const crSettings = await knex("cr_settings")
                            .where("activation_status", "Active")
                            .where("settings_name", "minimum_due_count_day").first();
                            
    const minDueCountDay = crSettings.settings_value;
    
    if (creditLimits.length > 0) {
        for (let i = 0; i < creditLimits.length; i++) {
            let element = creditLimits[i];
            let creditDisbursements = await knex("cr_credit_disbursements")
                                .select(knex.raw(`sum(due_amount) as due_amount`))
                                //.whereNot("due_amount", 0)
                                .where("activation_status", "Active")
                                .where("id_outlet", element.id_outlet)
                                .whereRaw(`DATE_ADD(sys_date,INTERVAL ${minDueCountDay} DAY) <= NOW()`).first();
            let updateMinDue = await knex("cr_retail_limit")
                            .where("activation_status", "Active")
                            .where("limit_status", "FI Confirmed")
                            .where("id_outlet", element.id_outlet)
                            .update({
                              "minimum_due": (typeof creditDisbursements !== 'undefined') ? creditDisbursements.due_amount :0
                            });
        }
    }
}

const batchUpdates = function (updates_to_be_done, type) {
    var interest_tbl, disbursement_tbl;
    if (type == 'sys') {
        interest_tbl = 'cr_disbursement_wise_interest';
        disbursement_tbl = 'cr_credit_disbursements';
    }else{
        interest_tbl = 'cr_disbursement_wise_interest_fi';
        disbursement_tbl = 'cr_credit_disbursements_fi';
    }
    return knex.transaction(trx=>{
        const queries = [];        
        for (const [key, value] of Object.entries(updates_to_be_done.disbursement_wise_interest_update)) {
            var q = knex(interest_tbl).where("id",key).update(
                value
            ).transacting(trx);
            queries.push(q);
        }
        
        for (const [key, value] of Object.entries(updates_to_be_done.disbursement_wise_interest_total_update)) {
            var q = knex(interest_tbl).where("id",key).update(
                value
            ).transacting(trx);
            queries.push(q);
        }
        
        for (const [key, value] of Object.entries(updates_to_be_done.credit_disbursement_update)) {
            var q = knex(disbursement_tbl).where("id",key).update(
                value
            ).transacting(trx);
            queries.push(q);
        }
        
        for (const [key, value] of Object.entries(updates_to_be_done.credit_disbursement_total_due_interest_update)) {
            var q = knex(disbursement_tbl).where("id",key).update(
                value
            ).transacting(trx);
            queries.push(q);
        }
        
        for (const [key, value] of Object.entries(updates_to_be_done.credit_disbursement_total_due_update)) {
            var q = knex(disbursement_tbl).where("id",key).update(
                value
            ).transacting(trx);
            queries.push(q);
        }
        if (type == 'sys'){
            for (const [key, value] of Object.entries(updates_to_be_done.retail_limit_update)) {
                var q = knex("cr_retail_limit").where("id_outlet",key).update(
                    value
                ).transacting(trx);
                queries.push(q);
            }
        }
        Promise.all(queries).then(trx.commit).catch(trx.rollback);        
    })
}

calculation.calculateDailyInterestForFi = function (req){
    return new Promise(async (resolve, reject) => {
        try {
            const disbursements = await knex("cr_credit_disbursements_fi")
                .whereNot("due_amount", 0)
                .where("activation_status", "Active");
            if (disbursements.length > 0) {
                const penalty_days = await getSettingsValue('penalty_days');
                var updates_to_be_done = {};
                var credit_disbursement_update = {};
                var credit_disbursement_total_due_update = {};
                var credit_disbursement_total_due_interest_update = {};
                var disbursement_wise_interest_update = {};
                var disbursement_wise_interest_total_update = {};
                for (let i = 0; i < disbursements.length; i++) {
                    const e = disbursements[i];
                    let disbursement_wise_interests = await knex("cr_disbursement_wise_interest_fi")
                                                            .where("id_cr_credit_disbursement_fi", e.id)
                                                            .where("is_current_transaction", 1);
                   
                    for (let j = 0; j < disbursement_wise_interests.length; j++) {
                        const element = disbursement_wise_interests[j];
                        disbursement_wise_interest_update[element.id] = {
                            sys_total_days : knex.raw(`DATEDIFF( NOW(), (SELECT cr_credit_disbursements_fi.sys_date FROM cr_credit_disbursements_fi WHERE cr_credit_disbursements_fi.id = cr_disbursement_wise_interest_fi.id_cr_credit_disbursement_fi))`),
                            sys_effective_days : knex.raw(`DATEDIFF( NOW(), created_at)`),
                            sys_interest_amount : knex.raw(`due_amount * (interest_rate_percentage / 100) * (sys_effective_days)`),
                            sys_service_charge_amount : knex.raw(`due_amount * (service_charge_rate_percentage / 100) * (sys_effective_days)`),
                            sys_penalty_days : knex.raw(`GREATEST(0, (sys_total_days - ${penalty_days}))`),
                            sys_penalty_amount : knex.raw(`due_amount * (penalty_rate_percentage / 100) * sys_penalty_days`),
                            is_penalty_interest : knex.raw(`LEAST(1, sys_penalty_days)`)
                        }
                        disbursement_wise_interest_total_update[element.id] = {
                            total_sys_interest_amount: knex.raw(`(sys_interest_amount + sys_service_charge_amount + sys_penalty_amount)`)
                        }
						// added by muzahid || to calculate day wise interest amount
						await daily_outstanding_log_fi(disbursements[i], disbursement_wise_interests[j]);
                    }
                    credit_disbursement_update[e.id] = {
                        total_interest_amount : knex.raw(`(SELECT
                                                            sum(
                                                                total_sys_interest_amount
                                                            ) 
                                                        FROM
                                                            cr_disbursement_wise_interest_fi 
                                                        WHERE
                                                            id_cr_credit_disbursement_fi = cr_credit_disbursements_fi.id 
                                                            )`)//#AND is_current_transaction = 1
                        //due_amount : knex.raw(`due_amount + (select sum((due_amount * (interest_rate_percentage / 100) * 1) + (due_amount * (service_charge_rate_percentage / 100) * 1) + (due_amount * (penalty_rate_percentage / 100) * 1 * is_penalty_interest)) from cr_disbursement_wise_interest where id_cr_credit_disbursement = cr_credit_disbursements.id)`),
                    }
                    credit_disbursement_total_due_interest_update[e.id] = {
                        due_interest_amount : knex.raw(`total_interest_amount - total_paid_interest_amount`)
                    }
                    credit_disbursement_total_due_update[e.id] = {
                        total_due_amount : knex.raw(`due_amount + due_interest_amount`)
                    }
                }
                updates_to_be_done["disbursement_wise_interest_update"] = disbursement_wise_interest_update;
                updates_to_be_done["disbursement_wise_interest_total_update"] = disbursement_wise_interest_total_update;
                updates_to_be_done["credit_disbursement_update"] = credit_disbursement_update;
                updates_to_be_done["credit_disbursement_total_due_update"] = credit_disbursement_total_due_update;
                updates_to_be_done["credit_disbursement_total_due_interest_update"] = credit_disbursement_total_due_interest_update;

                var batchUpdate = await batchUpdates(updates_to_be_done, 'fi');
                if(batchUpdate ==0 ) throw new Error("Job not Done");
                insertLog('fi', 'Job Complete');
                resolve(sendApiResult(true,"Job Complete"));
            }else{
                insertLog('fi', 'No data');
                resolve(sendApiResult(true,"No data"));
            }            
        } catch (error) {
            console.log(error.message)
            insertLog('fi', error.message);
            reject(sendApiResult(false, error.message))
        }      
    }); 
}

const daily_outstanding_log_fi = async function (disbursements, disbursement_wise_interests) {
	const interest_daily = {
		'id_cr_credit_disbursement' : disbursements.id,
		'id_outlet' : disbursements.id_outlet,
		'outlet_code' : disbursements.outlet_code,
		'sys_total_days' : parseInt(disbursement_wise_interests.sys_total_days + 1),
		'sys_effective_days' : parseInt(disbursement_wise_interests.sys_effective_days + 1),
		'sys_date' : moment(new Date()).subtract(1, 'day').format('YYYY-MM-DD'),
		'credit_amount' : disbursement_wise_interests.due_amount,
		'interest_rate' : disbursement_wise_interests.service_charge_rate_percentage,
		'principle_outstanding' : parseFloat(disbursement_wise_interests.due_amount).toFixed(2),
		'daywize_interest' : parseFloat((1 * disbursement_wise_interests.due_amount * disbursement_wise_interests.service_charge_rate_percentage) / 100).toFixed(2),
		'interest_outstanding' : parseFloat((parseInt(disbursement_wise_interests.sys_effective_days + 1) * disbursement_wise_interests.due_amount * disbursement_wise_interests.service_charge_rate_percentage) / 100).toFixed(2),		
		'daywize_total' : parseFloat(disbursement_wise_interests.due_amount + (1 * disbursement_wise_interests.due_amount * disbursement_wise_interests.service_charge_rate_percentage) / 100).toFixed(2),
		'total_outstanding' : parseFloat(disbursement_wise_interests.due_amount + (parseInt(disbursement_wise_interests.sys_effective_days + 1) * disbursement_wise_interests.due_amount * disbursement_wise_interests.service_charge_rate_percentage) / 100).toFixed(2)
	}
	await knex("cr_disbursement_wise_interest_daily_fi").insert(interest_daily);
}

// Total Outstanding Calculation Daily By Mahfuz
calculation.calculateTotalOutstandingDaily = async function (req) {
	return new Promise(async (resolve, reject) => {
        try {
			return knex.transaction(async trx => {
					const active_outlets = await knex("cr_retail_limit").select(
						"cr_retail_limit.outlet_code",
						"cr_retail_limit.outlet_name",
						"cr_retail_limit.phone",
						"cr_interest_settings.interest_percentage",
						"cr_interest_settings.service_charge_percentage",
						"cr_interest_settings.penalty_percentage",
					)
					.innerJoin("cr_interest_settings", "cr_retail_limit.outlet_code", "cr_interest_settings.outlet_code")
					.whereNotIn("cr_retail_limit.id_point", [334,344])
					.where("cr_retail_limit.activation_status", "Active")
					.where("cr_retail_limit.kyc_status", "Approved")
					.where("cr_retail_limit.limit_status", "FI Confirmed");
					const disbursements = await disbursementData();
					const payments = await paymentData();
					outstandingArray = [];
					//for(let i = 0; i < 5; i++) {
					for(let i = 0; i < active_outlets.length; i++){
						const outlet_code = active_outlets[i].outlet_code;
						outstanding = {};
						outstanding.sys_date = moment(new Date()).subtract(1, 'Day').format('YYYY-MM-DD');
						if(disbursements[outlet_code] !== undefined) {
							outstanding.outlet_code 	= disbursements[outlet_code].outlet_code;
							outstanding.outlet_name 	= disbursements[outlet_code].outlet_name;
							outstanding.phone 			= disbursements[outlet_code].phone;
							outstanding.total_credit 	= disbursements[outlet_code].total_credit;
							outstanding.total_interest 	= disbursements[outlet_code].total_interest;
							outstanding.total 			= outstanding.total_credit + outstanding.total_interest;
							if(payments[outlet_code] !== undefined){
								outstanding.paid_amount 			= payments[outlet_code].paid_amount;
								outstanding.paid_principle 			= payments[outlet_code].paid_principle;
								outstanding.paid_interest_amount 	= payments[outlet_code].paid_interest_amount;
							} else {
								outstanding.paid_amount 			= 0;
								outstanding.paid_principle 			= 0;
								outstanding.paid_interest_amount 	= 0;
							}
							
						} else {
							outstanding.outlet_code 			= outlet_code;
							outstanding.outlet_name 			= active_outlets[i].outlet_name;
							outstanding.phone 					= active_outlets[i].phone;
							outstanding.total_credit			= 0;
							outstanding.total_interest  		= 0;
							outstanding.total					= 0;
							outstanding.paid_amount 			= 0;
							outstanding.paid_principle 			= 0;
							outstanding.paid_interest_amount 	= 0;
						}
						outstanding.total_outstanding 		= outstanding.total - outstanding.paid_amount;
						outstanding.eligible 				= (outstanding.total_outstanding <= 0)? 0: 1;
						outstanding.principle_outstanding 	= outstanding.total_credit - outstanding.paid_principle;
						outstanding.interest_outstanding	= outstanding.total_interest - outstanding.paid_interest_amount;
						outstanding.interest_rate			= (active_outlets[i].interest_percentage + active_outlets[i].service_charge_percentage + active_outlets[i].penalty_percentage)/360.0;
						outstanding.interest				= (outstanding.principle_outstanding * outstanding.interest_rate) / 100.0;
						
						//console.log(outstanding);
						outstandingArray.push(outstanding);
					}
					var batchTotalOutstandingUpdate = await batchTotalOutstandingUpdates(outstandingArray);
					if(batchTotalOutstandingUpdate == 0 ) throw new Error("Job not Done");
					//totalOutstandingLog("Job Complete");
					resolve(sendApiResult(true,"Job Complete"));
			}).catch((error) => {
				totalOutstandingLog(error.message);
				reject(sendApiResult(false,"Total Outstanding Calculation Faild"));
				console.log(error) 
			});
		} catch (error) {
            totalOutstandingLog(error.message);
            reject(sendApiResult(false, error.message))
        }      
    });
}

const disbursementData = async function() {
	const today = moment(new Date()).format('YYYY-MM-DD');
	const disbursements = await knex("cr_credit_disbursements").select(
		"cr_retail_limit.outlet_code",
		"cr_retail_limit.outlet_name",
		"cr_retail_limit.phone",
		knex.raw("sum(cr_credit_disbursements.credit_amount) AS total_credit"),
		knex.raw("sum(cr_credit_disbursements.total_interest_amount) AS total_interest")
	)
	.innerJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "cr_credit_disbursements.id_outlet")
	.where("cr_credit_disbursements.sys_date", "<", today)
	.whereNotIn("cr_retail_limit.id_point", [334,344])
	.groupBy("cr_retail_limit.outlet_code");
	
	data = {};
	for (const [key, value] of Object.entries(disbursements)){
		data[value.outlet_code] = {};
		data[value.outlet_code]['outlet_code'] 		= value.outlet_code;
		data[value.outlet_code]['outlet_name'] 		= value.outlet_name;
		data[value.outlet_code]['phone'] 			= value.phone;
		data[value.outlet_code]['total_credit'] 	= value.total_credit;
		data[value.outlet_code]['total_interest'] 	= value.total_interest;
	}	
	return data;
}

const paymentData = async function() {
	const today = moment(new Date()).format('YYYY-MM-DD');
	const payments = await knex("cr_credit_payments").select(
		"cr_retail_limit.outlet_code",
		knex.raw("sum(cr_credit_payments.paid_amount) AS paid_amount"),
		knex.raw("sum(cr_credit_payments.paid_principle) AS paid_principle"),
		knex.raw("sum(cr_credit_payments.paid_interest_amount) AS paid_interest_amount")
	)
	.innerJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "cr_credit_payments.id_outlet")
	.where("cr_credit_payments.sys_date", "<", today)
	.whereNotIn("cr_retail_limit.id_point", [334,344])
	.groupBy("cr_retail_limit.outlet_code");

	data = {};
	for (const [key, value] of Object.entries(payments)){
		data[value.outlet_code] = {};
		data[value.outlet_code]['paid_amount'] 			= value.paid_amount;
		data[value.outlet_code]['paid_principle'] 		= value.paid_principle;
		data[value.outlet_code]['paid_interest_amount'] = value.paid_interest_amount;
	}	
	return data;
}

const batchTotalOutstandingUpdates = function (outstandingArray) {
	return knex.transaction(function (tx) {
	  return tx.insert(outstandingArray)
	  .into('cr_total_outstanding_daily_wise')
	  .then(function () {
		return true;
	  })
	  .catch(function (err) {
		console.log("Insert failed", err);
		throw err;
	  })
	})
	.then(function () { return true; })
	.catch(function (err) { console.log("Transaction failed!", err); throw err; });
}

const totalOutstandingLog = async function(msg) {
	
}

module.exports = calculation;