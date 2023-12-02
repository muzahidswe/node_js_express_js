const knex = require('../config/database')
const { sendApiResult, bankApi, OutletCreditInfo, mappedRetailerId } = require('../controllers/helperController');
const axios = require('axios');
const knexfile = require('../../knexfile');
var moment = require('moment');
let Disbursement = function () { }

Disbursement.takeNewCredit = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            if (req.requested_credit < 0) {
                resolve(sendApiResult(false, "Credit amount can not be less than zero", {status:100}));
                return false;
            }
            await knex.transaction(async trx => {
                const outlet_id = await mappedRetailerId(req.outlet_id);
				
				if (outlet_id == null) {
					resolve(sendApiResult(false, "Outlet not found", {status:100}));
					return false;
				}
				
                const dpid = req.dpid;
                const limit_info = await knex("cr_retail_limit")
                .select("minimum_due", "current_balance", "daily_limit", "outlet_code")
                .where("id_outlet", outlet_id)
                .where("activation_status", "Active").first();
                const minimum_due = limit_info.minimum_due;
                if (Math.min(Number(limit_info.current_balance), Number(limit_info.daily_limit)) < Number(req.requested_credit)) {
                    reject(sendApiResult(false, "This Outlet is can take maximum " + parseFloat(Math.min(Number(limit_info.current_balance), Number(limit_info.daily_limit))).toFixed(2) + ' amount of credit today.'));
                    return false;
                }
                if (parseFloat(minimum_due) > 0) {
                    reject(sendApiResult(false, "This Outlet is Not Allowed to take Credit due to having minimum due."));
                } else {
                    const fi = await knex("cr_fi_institute")
                    .select("cr_fi_institute.transaction_from")
                    .leftJoin("cr_dh_fi", "cr_dh_fi.id_fi", "cr_fi_institute.id")
                    .leftJoin("distributorspoint", "distributorspoint.dsid", "cr_dh_fi.id_dh")
                    .where("distributorspoint.id", dpid).first();

                    const transaction_from = fi.transaction_from;

                    if (transaction_from == 'fi') {
                        const checkForDailyRequestLimit = await knex("cr_fi_trx_ack")
                        .where("outlet_id", outlet_id)
                        .whereRaw('DATE_FORMAT(created_at, "%Y-%m-%d") = DATE_FORMAT(CURRENT_DATE(), "%Y-%m-%d")')
                        .select(
                            knex.raw('count(*) as total'),
                            "ack_token"
                            )
                        .count({ total: '*' }).first();
                        if ((typeof req.ack_token === 'undefined' || !req.ack_token) && checkForDailyRequestLimit.total >0) {
                            reject(sendApiResult(false, "Daily request limit exceeded", {status:403}));
                        }else if(req.ack_token != checkForDailyRequestLimit.ack_token){
                            reject(sendApiResult(false, "Token mismatch", {status:403}));
                        }else{
                            const check = await knex("cr_fi_trx_ack")
                            .where({
                                outlet_id: outlet_id,
                                ack_token: req.ack_token ? req.ack_token : null
                            })
                            .select(
                                knex.raw("count(*) as total"),
                                "status_code",
                                "ack_token"
                                ).first();
                            if(check.total == 0) {
                                var params = {
                                    "outlet_id": outlet_id,
                                    "amount": req.requested_credit
                                }
                                const bankApiResult = await bankApi(params);
                                const outletCode = limit_info.outlet_code;
                                const insert = await knex("cr_fi_trx_ack")
                                .insert({
                                            //ack_token: bankApiResult.token,     
                                            ack_token: knex.raw(`CONCAT('`+outletCode + `', '_', now())`),                                        
                                            outlet_id: outlet_id,
                                            amount: req.requested_credit,
                                            status_code: '102'
                                        });
                                if (insert == 0) reject(sendApiResult(false, "Please try after some time", {status:400}));
                                const lastRow = await knex("cr_fi_trx_ack").where("id", insert[0]).first();                                
                                const unique_code = lastRow.ack_token;
                                resolve(sendApiResult(true, "Please try after some time", {status:102, "ack_token":unique_code}));
                            }else{
                                if (check.status_code == 102) {
                                    resolve(sendApiResult(false, "Please try after some time", {status:102}));
                                }else if(check.status_code == 100){
                                    resolve(sendApiResult(false, "You are rejected to take credit by FI", {status:100}));
                                }else if(check.status_code == 400){
                                    resolve(sendApiResult(false, "Insufficient Balance", {status:100}));
                                }else if(check.status_code == 200){
                                    await doTrxProcess(req, trx, check.ack_token, limit_info);
                                    resolve(sendApiResult(true, "Credit Taken Successfully",{status:200}));
                                }else{
                                    reject(sendApiResult(false, "Something bad happened", {status:500}))
                                }
                            }    
                        }                                            
                    }else{
                        const checkForDailyRequestLimit = await knex("cr_credit_disbursements")
                        .where("id_outlet", outlet_id)
                        .whereRaw('DATE_FORMAT(sys_date, "%Y-%m-%d") = DATE_FORMAT(CURRENT_DATE(), "%Y-%m-%d")')
                        .count({ total: '*' }).first();
                        if (checkForDailyRequestLimit.total >0) {
                            resolve(sendApiResult(false, "Daily request limit exceeded", {status:403}));
                        }else{
                            let takeCredit = await doTrxProcess(req, trx, null, limit_info);                            
                        }                        
                    }
                    
                }
            }).then(async function(){
                let outlet_credit = await OutletCreditInfo(req.outlet_id);
                // const data = {
                //     credit_info : outlet_credit,
                //     status : 200,
                //     success : true,
                //     message : 'Credit Taken Successfully'
                // }
                // const crinfo = {
                //     data : data
                // }
                // resolve(crinfo);
                resolve(sendApiResult(true, "Credit Taken Successfully", { status: 200, credit_info: outlet_credit }));
            }).catch(function (error) { 
                const data = {
                    credit_info : [],
                    status : 100,
                    success : false,
                    message : error.message
                }
                const crinfo = {
                    data : data
                }
                resolve(crinfo);
            });   
        } catch (error) {
            reject(sendApiResult(false, error.message))
        }
    })
}

const doTrxProcess = async function(req, trx, ack_token, retail_limit_info){
	
	const outlet_id = await mappedRetailerId(req.outlet_id);
				
	if (outlet_id == null) {
		resolve(sendApiResult(false, "Outlet not found", {status:100}));
		return false;
	}
	
    const limit_info = await knex("cr_retail_limit")
    .where("id_outlet", outlet_id)
    .where("activation_status", "Active").first();
    const carry_amount = parseFloat(limit_info.carry_amount);
    
    //const interest_settings = await knex("cr_interest_settings").where("id_point", req.dpid).where("activation_status", "Active").first();
	const interest_settings = await knex("cr_interest_settings").where("outlet_code", limit_info.outlet_code).where("activation_status", "Active").first();
	
	const service_charge = await knex("retailers")
								.select("cr_service_charge_settings.id AS service_charge_settings_id")
								.leftJoin("cr_service_charge_settings", "cr_service_charge_settings.id_point", "retailers.dpid")                    
								.where("retailers.retailer_code", retail_limit_info.outlet_code)
								.where("retailers.stts", 1).first();

    const service_charge_percentage_per_day = interest_settings.service_charge_percentage / 360;
    const interest_rate_percentage_per_day = interest_settings.interest_percentage / 360;
    const penalty_rate_percentage_per_day = interest_settings.penalty_percentage / 360;
    const disbursement_id = await trx("cr_credit_disbursements").insert({
        id_outlet: outlet_id,
        outlet_code: retail_limit_info.outlet_code,
        credit_amount: req.requested_credit - carry_amount,
        sys_date: new Date(),
        due_amount: req.requested_credit - carry_amount,
        created_by: req.created_by,
        ack_token: ack_token,
        invoice_amount: req.invoice_amount ? req.invoice_amount : 0,
        cash_payment: req.cash_payment ? req.cash_payment : 0,
        available_daily_limit: retail_limit_info.daily_limit,
		take_credit : (req.take_credit != undefined) ? req.take_credit : 'online',
        util_rate_against_daily_limit: parseFloat(((req.requested_credit - carry_amount) / retail_limit_info.daily_limit) * 100),
		service_charge_settings_id : service_charge.service_charge_settings_id
    });
    if (disbursement_id == 0) throw new Error("Credit Disbursement Not Inserted");

    const disbursement_interest_insert = await trx("cr_disbursement_wise_interest").insert({
        id_cr_credit_disbursement: disbursement_id[0],
        due_amount: req.requested_credit - carry_amount,
        interest_rate_percentage: interest_rate_percentage_per_day,
        service_charge_rate_percentage: service_charge_percentage_per_day,
        penalty_rate_percentage : penalty_rate_percentage_per_day,
        created_by: req.created_by
    });
    if (disbursement_interest_insert == 0) throw new Error("Error Occurred When inserting Credit Request");

    var update_retailer_limit = await trx("cr_retail_limit").update({
        current_balance: knex.raw(`current_balance - ` + (req.requested_credit - carry_amount)),
        total_due: knex.raw(`total_due +` + (req.requested_credit - carry_amount)),
        loan_availed: 1,
        carry_amount : 0
    }).where("id_outlet", outlet_id);
}

const batchInsertUpdate = async function (req, update_disbursements, insert_arr, update_interest_ids, money_left) {
	
	const outlet_id = await mappedRetailerId(req.outlet_id);
				
	if (outlet_id == null) {
		resolve(sendApiResult(false, "Outlet not found", {status:100}));
		return false;
	}
	
	const service_charge = await knex("cr_service_charge_settings").select("id AS service_charge_settings_id").where("id_point", req.dpid).where("status", 1).first();
	const retailer_info = await knex("retailers").select("retailer_code").where("id", req.outlet_id).where("stts", 1).first();
		
    return knex.transaction(trx=>{
        const queries = [];
        
        var current_balance_incremnt = req.credit_payment;
        var total_interest_paid = 0;
        var total_due = 0;
        for (const [key, value] of Object.entries(update_disbursements)) {
            //current_balance_incremnt += value.paid_amount;
            total_interest_paid += value.currently_paid_interest;
            total_due += value.due_amount;
            var q= knex("cr_credit_disbursements").where("id",key).update({
                paid_amount:value.paid_amount,
                due_amount:value.due_amount,
                total_paid_interest_amount:value.total_paid_interest_amount,
                // due_interest_amount: knex.raw(`due_interest_amount -` + value.total_paid_interest_amount),
                // total_due_amount: knex.raw(`total_due_amount -` + value.total_paid_interest_amount)
            }).transacting(trx);
            queries.push(q);
			if(value.due_amount == 0){
				update_interest_ids.push(key);
			}
        }

        var query = knex("cr_credit_payments").insert({
            id_outlet: outlet_id,
            paid_amount:req.credit_payment,
            sys_date:new Date(),
            paid_interest_amount: total_interest_paid,
            paid_principle: req.credit_payment - total_interest_paid - money_left,
            carry_amount:money_left,
			service_charge_settings_id: service_charge.service_charge_settings_id,
            outlet_code: retailer_info.retailer_code,
            created_by:req.created_by
        }).transacting(trx);
        queries.push(query);

        var q = knex("cr_disbursement_wise_interest").whereIn("id_cr_credit_disbursement",update_interest_ids).update({
            is_current_transaction:0
        }).transacting(trx);
        queries.push(q);

        var qr=  knex("cr_disbursement_wise_interest").insert(insert_arr).transacting(trx);
        queries.push(qr);

        if (money_left > 0) {
            var query =  knex("cr_carry_amount").insert({
                id_outlet: outlet_id,
                carry_amount: money_left
            }).transacting(trx);
            queries.push(query);
        }
        
        var update_retail_current_balance = knex("cr_retail_limit")
        .whereRaw(`id_outlet = ${outlet_id} AND activation_status = 'Active'`)
                                                // .where("id_outlet", outlet_id)
                                                // .where("activation_status", "Active")
                                                .update({
                                                    current_balance: knex.raw(`current_balance + `+(current_balance_incremnt - money_left)),
                                                    total_due: total_due,
                                                    total_interest_due: knex.raw(`total_interest_due -` +total_interest_paid),
                                                    minimum_due: knex.raw(`GREATEST(0, minimum_due - `+current_balance_incremnt+`)`),
                                                    carry_amount: knex.raw(`carry_amount + `+ money_left)
                                                }).transacting(trx);
                                                queries.push(update_retail_current_balance);
                                                Promise.all(queries).then(trx.commit).catch(trx.rollback);
                                            })
}
Disbursement.outletCreditPayment = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            
			const outlet_id = await mappedRetailerId(req.outlet_id);
            
            if (outlet_id == null) {
				resolve(sendApiResult(false, "Outlet not found", {status:100}));
				return false;
			}
            
            const openingDue =await knex('cr_retail_limit').select('total_due').where('id_outlet',outlet_id).first();
           
            console.log("opening due",openingDue.total_due);
            console.log("opening due after ceil",Math.ceil(openingDue.total_due));

            console.log("payment",req.credit_payment);

            if(req.credit_payment > Math.ceil(openingDue.total_due)){
                console.log("Payment amount not greater than Opening due");
                resolve(sendApiResult(false, "Payment amount not greater than Opening due", {status:100}));
                return false;
            }
            
            const checkForDailyPaymentLimit = await knex("cr_credit_payments")
                        .where("id_outlet", outlet_id)
                        .where("sys_date", knex.raw(`DATE(NOW())`))
                        .select(
                            knex.raw('count(*) as total')
                            )
                        .count({ total: '*' }).first();
            if (checkForDailyPaymentLimit.total > 0) {
                resolve(sendApiResult(false, "Daily payment limit exceeded", {status:403}));
                return false;
            }
            if (req.credit_payment < 0) {
                resolve(sendApiResult(false, "Payment amount can not be less than zero", {status:100}));
                return false;
            }
            if (req.credit_payment == 0) {
                let outlet_credit = await OutletCreditInfo(req.outlet_id);
                resolve(sendApiResult(true,"Payment Complete",outlet_credit));
                return false;
            }
            const disbursements = await knex("cr_credit_disbursements")
            .where("id_outlet", outlet_id)
            .whereNot("due_amount", 0)
            .where("activation_status", "Active");
			const retail_info = await knex("cr_retail_limit").where("id_outlet", outlet_id).first();
            //const interest_settings = await knex("cr_interest_settings").where("id_point", req.dpid).where("activation_status", "Active").first();
			const interest_settings = await knex("cr_interest_settings").where("outlet_code", retail_info.outlet_code).where("activation_status", "Active").first();

            const service_charge_percentage_per_day = interest_settings.service_charge_percentage / 360;
            const interest_rate_percentage_per_day = interest_settings.interest_percentage / 360;
            const penalty_rate_percentage_per_day = interest_settings.penalty_percentage / 360;
            let update_disbursements = {};
            let money_left = req.credit_payment;

            console.log(disbursements.length);
            if (disbursements.length > 0) {
                //for taking interest first
                for (let index = 0; index < disbursements.length; index++) {

                    const e = disbursements[index];
                    let total_unpaid_interest = e.total_interest_amount - e.total_paid_interest_amount;
                    
                    let paid_interest = 0
                    if (total_unpaid_interest <= money_left) {
                        money_left = money_left - total_unpaid_interest;

                        paid_interest = total_unpaid_interest;
                    } else {
                        paid_interest = money_left;

                        money_left = 0;
                    }

                    if (e.id in update_disbursements) {
                        update_disbursements[e.id]['total_paid_interest_amount'] = e.total_paid_interest_amount + paid_interest;
                        update_disbursements[e.id]['currently_paid_interest'] = paid_interest;
                    } else {
                        update_disbursements[e.id] = {
                            total_paid_interest_amount: e.total_paid_interest_amount + paid_interest,
                            paid_amount: e.paid_amount,
                            due_amount: e.due_amount,
                            currently_paid_interest: paid_interest
                        }
                    }
                    if (money_left == 0) {
                        break;
                    }
                }

                //now take due money
                if (money_left > 0) {
                    for (let index = 0; index < disbursements.length; index++) {
                        const e = disbursements[index];
                        let paid_due = 0;
                        let due_amount = e.due_amount
                        if (due_amount <= money_left) {
                            money_left = money_left - due_amount;
                            paid_due = due_amount;
                            due_amount = due_amount - paid_due;
                        } else {
                            paid_due = money_left;
                            due_amount = due_amount - paid_due;
                            money_left = 0;
                        }

                        update_disbursements[e.id]['due_amount'] = due_amount;
                        update_disbursements[e.id]['paid_amount'] = e.paid_amount + paid_due;
                    }
                }else{

                }
                
                let insert_interest = {};
                let cr_disbursement_ids = [];
                for (const [key, value] of Object.entries(update_disbursements)) {
                    cr_disbursement_ids.push(key);
                    if (value.due_amount != 0) {
                        insert_interest[key] = {
                            "due_amount": value.due_amount,
                        }
                    }
                }

                const interests = await knex("cr_disbursement_wise_interest")
                .innerJoin("cr_credit_disbursements","cr_disbursement_wise_interest.id_cr_credit_disbursement","cr_credit_disbursements.id")
                .whereIn("cr_disbursement_wise_interest.id_cr_credit_disbursement", cr_disbursement_ids)
                .where("is_current_transaction", 1)
                .whereNot("cr_credit_disbursements.due_amount",0);
                let insert_arr = [];
                let update_interest_ids = [];
                for (let index = 0; index < interests.length; index++) {
                    const e = interests[index];
                    if (e.id_cr_credit_disbursement in insert_interest) {

                        if (e.due_amount != insert_interest[e.id_cr_credit_disbursement]['due_amount']) {
                            update_interest_ids.push(e.id);
                            insert_arr.push({
                                id_cr_credit_disbursement: e.id_cr_credit_disbursement,
                                due_amount: insert_interest[e.id_cr_credit_disbursement]['due_amount'],
                                sys_total_days: e.sys_total_days,
                                interest_rate_percentage: interest_rate_percentage_per_day,
                                penalty_rate_percentage : penalty_rate_percentage_per_day,
                                service_charge_rate_percentage: service_charge_percentage_per_day,
                                created_by: req.created_by
                            })
                        }
                    }

                }
                
                // if (money_left > 0) {
                //     throw new Error("You have Paid More")
                // }
                
                var batchUpdate = await batchInsertUpdate(req, update_disbursements, insert_arr, update_interest_ids, money_left);
                if(batchUpdate == 0 ) throw new Error("Payment Not Complete");

                let outlet_credit = await OutletCreditInfo(req.outlet_id);

                resolve(sendApiResult(true,"Payment Complete",outlet_credit));

            }else{
                reject(sendApiResult(false, "Not Found or Credit not taken."));
            }


        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Disbursement.checkTodaysCredit = function (outlet_id) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Outlet ID: "+outlet_id);
            let status = 0;
            var message = "";
            const outletStatus = await knex("cr_credit_disbursements")
                                        .select("credit_amount")
                                        .where("sys_date", moment(new Date()).format('YYYY-MM-DD'))
                                        .where("id_outlet",outlet_id).first();
           
           if(outletStatus ==null){
            status = 0;
            message = "No credit taken on "+ moment(new Date()).format('YYYY-MM-DD');
           }else{
            status = outletStatus.credit_amount;
            message = outletStatus.credit_amount+" amount credit taken on "+ moment(new Date()).format('YYYY-MM-DD');
           }
            var data = {
                success: true,
                message: message,
                data: status,
              };
            resolve(data);
        } catch (error) {
           
            var status = 0;
            message = error.message;
            console.log(error.message);
            reject(sendApiResult(false, message, status));
        }
    })
}

Disbursement.checkLiveSyncStatus = function (id_point) {
    return new Promise(async (resolve, reject) => {
        try {            
            const liveSyncStatus = await knex("cr_point_wise_live_sync")
                                .select(
									"cr_point_wise_live_sync.live_sync"
                                )
								.where("cr_point_wise_live_sync.status", 1)
								.where("cr_point_wise_live_sync.id_point", id_point)
								.first();
																            
            resolve(sendApiResult(true, "Live Sync Status Fetched Successfully", liveSyncStatus));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Disbursement.getInterestSettings = function (id_point) {
    return new Promise(async (resolve, reject) => {
        try {
			const by_point_interest_settings = await knex("cr_interest_settings")
										.select(
											"service_charge_percentage",
											"interest_percentage"
										)
										.where("id_point", id_point)
										.where("activation_status", "Active")
										.first();
										
			const interest_settings = {
				"service_charge_percentage" : (by_point_interest_settings.service_charge_percentage / 360),
				"interest_percentage" : (by_point_interest_settings.interest_percentage / 360)
			}
										
            resolve(sendApiResult(true, "Interest Settings Fetched Successfully", interest_settings));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Disbursement.getOutStandingByRouteId = function (req, res) {
    return new Promise(async (resolve, reject) => {
      try {
        const routeId = req.rtid
        let sysDate = req.date
        if (sysDate) {
          sysDate = moment(sysDate).format('YYYY-MM-DD')
        } else {
          reject(sendApiResult(false, 'Date peremeter is missing', {}))
        }
  
        if (!routeId) {
          reject(sendApiResult(false, 'Route id peremeter is missing', {}))
        }
  
        const outletCode = await knex('retailers')
          .where('retailers.stts', 1)
          .where('retailers.rtid', routeId)
          .groupBy('retailers.retailer_code')
          .pluck('retailer_code')
        const totalCredit = await knex('cr_credit_disbursements')
          .select(
            knex.raw(
              'IFNULL(sum(cr_credit_disbursements.credit_amount),0) AS total_disbursed'
            )
          )
          .where('cr_credit_disbursements.sys_date', sysDate)
          .whereIn('cr_credit_disbursements.outlet_code', outletCode)
  
        const totalPayment = await knex('cr_credit_payments')
          .select(
            knex.raw(
              'IFNULL(sum(cr_credit_payments.paid_amount),0) AS total_paid'
            )
          )
          .where('cr_credit_payments.sys_date', sysDate)
          .whereIn('cr_credit_payments.outlet_code', outletCode)
  
        resolve(
          sendApiResult(true, 'date and route wise disburment and payment', {
            total_disbursed: totalCredit[0].total_disbursed,
            total_paid: totalPayment[0].total_paid,
          })
        )
      } catch (error) {
        reject(sendApiResult(false, error.message))
      }
    })
}
module.exports = Disbursement;