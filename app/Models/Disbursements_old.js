const knex = require('../config/database')
const { sendApiResult, bankApi, OutletCreditInfo } = require('../controllers/helperController');
const axios = require('axios');
const knexfile = require('../../knexfile');

let Disbursement = function () { }

Disbursement.takeNewCredit = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            await knex.transaction(async trx => {
                const outlet_id = req.outlet_id;
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
                                    await doTrxProcess(req,trx, check.ack_token);
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
                            resolve(sendApiResult(false, "Daily request limit exceeded", {status:100}));
                        }else{
                            let takeCredit = await doTrxProcess(req,trx, null);                            
                        }                        
                    }
                    
                }
            }).then(async function(){
                let outlet_credit = await OutletCreditInfo(req.outlet_id);
                const data = {
                    credit_info : outlet_credit,
                    status : 200,
                    success : true,
                    message : 'Credit Taken Successfully'
                }
                const crinfo = {
                    data : data
                }
                resolve(crinfo);
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

const doTrxProcess = async function(req, trx, ack_token){

    const limit_info = await knex("cr_retail_limit")
                            .where("id_outlet", req.outlet_id)
                            .where("activation_status", "Active").first();
    const carry_amount = parseFloat(limit_info.carry_amount);
    
    const interest_settings = await knex("cr_interest_settings").where("id_point", req.dpid).where("activation_status", "Active").first();

    const service_charge_percentage_per_day = interest_settings.service_charge_percentage / 360;
    const interest_rate_percentage_per_day = interest_settings.interest_percentage / 360;
    const penalty_rate_percentage_per_day = interest_settings.penalty_percentage / 360;
    const disbursement_id = await trx("cr_credit_disbursements").insert({
        id_outlet: req.outlet_id,
        credit_amount: req.requested_credit - carry_amount,
        sys_date: new Date(),
        due_amount: req.requested_credit - carry_amount,
        created_by: req.created_by,
        ack_token: ack_token
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
                                            total_due: knex.raw(`total_due +` + req.requested_credit)
                                        }).where("id_outlet", req.outlet_id);
}

const batchInsertUpdate = function (req,update_disbursements,insert_arr,update_interest_ids, money_left) {
    return knex.transaction(trx=>{
        const queries = [];
        var query = knex("cr_credit_payments").insert({
            id_outlet:req.outlet_id,
            paid_amount:req.credit_payment,
            sys_date:new Date(),
            created_by:req.created_by
        }).transacting(trx);
        queries.push(query);
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
        }
        var q = knex("cr_disbursement_wise_interest").whereIn("id_cr_credit_disbursement",update_interest_ids).update({
            is_current_transaction:0
        }).transacting(trx);
        queries.push(q);

        var qr=  knex("cr_disbursement_wise_interest").insert(insert_arr).transacting(trx);
        queries.push(qr);

        if (money_left > 0) {
            var query =  knex("cr_carry_amount").insert({
                id_outlet: req.outlet_id,
                carry_amount: money_left
            }).transacting(trx);
            queries.push(query);
        }
        
        var update_retail_current_balance = knex("cr_retail_limit")
                                                .whereRaw(`id_outlet = ${req.outlet_id} AND activation_status = 'Active'`)
                                                // .where("id_outlet", req.outlet_id)
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
            const disbursements = await knex("cr_credit_disbursements")
                .where("id_outlet", req.outlet_id)
                .whereNot("due_amount", 0)
                .where("activation_status", "Active");
            const interest_settings = await knex("cr_interest_settings").where("id_point", req.dpid).where("activation_status", "Active").first();

            const service_charge_percentage_per_day = interest_settings.service_charge_percentage / 360;
            const interest_rate_percentage_per_day = interest_settings.interest_percentage / 360;
            const penalty_rate_percentage_per_day = interest_settings.penalty_percentage / 360;
            let update_disbursements = {};
            let money_left = req.credit_payment;

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
                
                var batchUpdate = await batchInsertUpdate(req,update_disbursements,insert_arr,update_interest_ids, money_left);
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
module.exports = Disbursement;