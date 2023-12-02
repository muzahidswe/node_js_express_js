const knex = require('../config/database')
const { sendApiResult } = require('../controllers/helperController');

let cbl = function () { }

cbl.changeDrawdownStatus = (req) => {
    return new Promise(async (resolve,reject)=>{
        try {
            const update = await knex("cr_fi_trx_ack")
                            .where("ack_token", req.unique_code)
                            .update({
                                "status_code": req.ack_status,
                                "request_params": JSON.stringify(req)
                            });
            if(update == 0) resolve(sendApiResult(false,"Not found."));
            resolve(sendApiResult(true,"Updated Successfully",update));
        } catch (error) {
            reject(sendApiResult(false,error.message));
        }
    });
}

cbl.receiveEodTotal = async (req) => {
    // const check = await knex("cr_request_responses")
    //                                 .where({
    //                                     date: knex.raw(`DATE_FORMAT(NOW(), "%Y-%m-%d")`),
    //                                     type: 'eod'
    //                                 })
    //                                 .select(
    //                                     knex.raw("count(*) as total")
    //                                 ).first();
    // if (check.total > 0) {
    //     throw new Error("Date Conflict");
    // }
    var insert = await knex("cr_request_responses").insert({
        date: knex.raw(`DATE_FORMAT(NOW(), "%Y-%m-%d")`),
        type: 'eod',
        request_params: JSON.stringify(req)
    });
    if (insert == 0) {
        reject(sendApiResult(false,"EOD not Inserted"));
        return false;
    }else{
        const lastEodId = insert[0];
        return knex.transaction( trx=>{
            const queries = [];
            var query;
            for (let j = 0; j < req.distributors.length; j++) {
                const distributor = req.distributors[j];
                query = knex("cr_fi_trx_ack")
                                .where({"ack_token": distributor.unique_code})
                                .update({
                                    "request_response_id": lastEodId,
                                    "eod_status": knex.raw(`(
                                        CASE
                                            WHEN amount = `+distributor.amount+` THEN 'Reconciled'
                                            WHEN amount <> `+distributor.amount+` THEN 'Not Reconciled'
                                        END
                                    )`)
                                })
                                .transacting(trx);
                queries.push(query);
            }
            // for (let i = 0; i < req.anchor_data.length; i++) {
            //     const anchor_data = req.anchor_data[i];
            //     for (let j = 0; j < anchor_data.distributors.length; j++) {
            //         const distributor = anchor_data.distributors[j];
            //         query = knex("cr_fi_trx_ack")
            //                         .where({"ack_token": distributor.unique_code})
            //                         .update({
            //                             "request_response_id": lastEodId,
            //                             "eod_status": knex.raw(`(
            //                                 CASE
            //                                     WHEN amount = `+distributor.amount+` THEN 'Reconciled'
            //                                     WHEN amount <> `+distributor.amount+` THEN 'Not Reconciled'
            //                                 END
            //                             )`)
            //                         })
            //                         .transacting(trx);
            //         queries.push(query);
            //     }
            // }
            query = knex("cr_fi_trx_ack")
                        .whereRaw('DATE_FORMAT(created_at, "%Y-%m-%d") = DATE_FORMAT(NOW(), "%Y-%m-%d")')
                        //.whereNull("eod_id")
                        .whereNull("request_response_id")
                        .update({
                            "eod_status" : "Not Found"
                        }).transacting(trx);
            queries.push(query);
            Promise.all(queries).then(trx.commit).catch(async ()=>{
                trx.rollback;
                await knex("cr_request_responses").where({id: lastEodId}).delete();
            });
        });
    }    
}

cbl.receiveDisbursementsDetails = async (req) => {
    // const check = await knex("cr_request_responses")
    //                                 .where({
    //                                     date: knex.raw(`DATE_FORMAT(NOW(), "%Y-%m-%d")`),
    //                                     type: 'rdd'
    //                                 })
    //                                 .select(
    //                                     knex.raw("count(*) as total")
    //                                 ).first();
    // if (check.total > 0) {
    //     throw new Error("Date Conflict");
    // }
    var insert =await knex("cr_request_responses").insert({
        date: knex.raw(`DATE_FORMAT(NOW(), "%Y-%m-%d")`),
        type: 'rdd',
        request_params: JSON.stringify(req)
    });
    if (insert == 0) {
        reject(sendApiResult(false,"RDD not Inserted"));
        return false;
    }else{
        const lastRddId = insert[0];        
        return knex.transaction( trx=>{
            const queries = [];
            var query;
            if (typeof req.distributors !== 'undefined' && req.distributors.length) {
                for (let j = 0; j < req.distributors.length; j++) {
                    const distributor = req.distributors[j];
                    if (distributor.cbs_trx_id) {
                        query = knex("cr_credit_disbursements")
                                    .where("ack_token", distributor.unique_code)
                                    .update({
                                        "fi_date": new Date(),
                                        "request_response_id" : lastRddId
                                    }).transacting(trx);
                        queries.push(query);
                        doFiDisbursementInterestActions(distributor);
                    }
                }
            }
            if (typeof req.distributor_code !== 'undefined' && req.distributor_code.length) {
                query = knex("cr_credit_disbursements")
                            .where("ack_token", req.unique_code)
                            .update({
                                "fi_date": new Date(),
                                "request_response_id" : lastRddId
                            }).transacting(trx);
                queries.push(query);
                doFiDisbursementInterestActions(req);
            }            
            // if (typeof req.anchor_data === 'undefined') {
            //     query = knex("cr_credit_disbursements")
            //                 .where("ack_token", req.unique_code)
            //                 .update({
            //                     "fi_date": new Date(),
            //                     "request_response_id" : lastRddId
            //                 }).transacting(trx);
            //     queries.push(query);
            //     doFiDisbursementInterestActions(req);
            // }else{
            //     for (let i = 0; i < req.anchor_data.length; i++) {
            //         const anchor_data = req.anchor_data[i];
            //         for (let j = 0; j < anchor_data.distributors.length; j++) {
            //             const distributor = anchor_data.distributors[j];
            //             if (distributor.cbs_trx_id) {
            //                 query = knex("cr_credit_disbursements")
            //                             .where("ack_token", distributor.unique_code)
            //                             .update({
            //                                 "fi_date": new Date(),
            //                                 "request_response_id" : lastRddId
            //                             }).transacting(trx);
            //                 queries.push(query);
            //                 doFiDisbursementInterestActions(distributor);
            //             }
            //         }
            //     }
            // }
            Promise.all(queries).then(trx.commit).catch(async ()=>{
                trx.rollback;
                await knex("cr_request_responses").where({id: lastRddId}).delete();
            });
        });
    }
}

const doFiDisbursementInterestActions = async function (param) { 
    const limitInfo = await knex.from("cr_retail_limit")
                                        .where("outlet_code", param.distributor_code)
                                        .first();

    const interest_settings = await knex("cr_interest_settings")
                            .where("id_point", limitInfo.id_point)
                            .where("activation_status", "Active").first();

    const service_charge_percentage_per_day = interest_settings.service_charge_percentage / 360;
    const interest_rate_percentage_per_day = interest_settings.interest_percentage / 360;
    const penalty_rate_percentage_per_day = interest_settings.penalty_percentage / 360;
    const disbursement_id = await knex("cr_credit_disbursements_fi").insert({
                                            id_outlet: limitInfo.id_outlet,
                                            credit_amount: param.amount,
                                            sys_date: new Date(),
                                            due_amount: param.amount,
                                        });
    if (disbursement_id == 0) throw new Error("Credit Disbursement Not Inserted");

    const disbursement_interest_insert = await knex("cr_disbursement_wise_interest_fi").insert({
                                            id_cr_credit_disbursement_fi: disbursement_id[0],
                                            due_amount: param.amount,
                                            interest_rate_percentage: interest_rate_percentage_per_day,
                                            service_charge_rate_percentage: service_charge_percentage_per_day,
                                            penalty_rate_percentage : penalty_rate_percentage_per_day
                                        });
    if (disbursement_interest_insert == 0) throw new Error("Error Occurred When inserting Credit Request");
}

cbl.receiveRepayment = async (req) => {
    // const check = await knex("cr_request_responses")
    //                                 .where({
    //                                     date: knex.raw(`DATE_FORMAT(NOW(), "%Y-%m-%d")`),
    //                                     type: 'rdd'
    //                                 })
    //                                 .select(
    //                                     knex.raw("count(*) as total")
    //                                 ).first();
    // if (check.total > 0) {
    //     throw new Error("Date Conflict");
    // }
    var insert =await knex("cr_request_responses").insert({
        date: knex.raw(`DATE_FORMAT(NOW(), "%Y-%m-%d")`),
        type: 'rr',
        request_params: JSON.stringify(req)
    });
    if (insert == 0) {
        reject(sendApiResult(false,"RR not Inserted"));
        return false;
    }else{
        const lastRddId = insert[0];        
        return knex.transaction( trx=>{
            const queries = [];
            var query;
            if (typeof req.distributors !== 'undefined' && req.distributors.length) {
                for (let j = 0; j < req.distributors.length; j++) {
                    const distributor = req.distributors[j];
                    if (distributor.cbs_trx_id) {
                        query = knex("cr_credit_disbursements")
                                    .where("ack_token", distributor.unique_code)
                                    .update({
                                        "fi_date": new Date(),
                                        "request_response_id" : lastRddId
                                    }).transacting(trx);
                        queries.push(query);
                        doFiDisbursementInterestActions(distributor);
                    }
                }
            }
            if (typeof req.distributor_code !== 'undefined' && req.distributor_code.length) {
                query = knex("cr_credit_disbursements")
                            .where("ack_token", req.unique_code)
                            .update({
                                "fi_date": new Date(),
                                "request_response_id" : lastRddId
                            }).transacting(trx);
                queries.push(query);
                doFiSettlementActions(req);
            }
            Promise.all(queries).then(trx.commit).catch(async ()=>{
                trx.rollback;
                await knex("cr_request_responses").where({id: lastRddId}).delete();
            });
        });
    }
}

const doFiSettlementActions = async function (param) { 
    const limitInfo = await knex.from("cr_retail_limit")
                                        .where("outlet_code", param.distributor_code)
                                        .first();
    const disbursements = await knex("cr_credit_disbursements_fi")
                .where("id_outlet", limitInfo.id_outlet)
                .whereNot("due_amount", 0)
                .where("activation_status", "Active");
    const interest_settings = await knex("cr_interest_settings").where("id_point", limitInfo.id_point).where("activation_status", "Active").first();

    const service_charge_percentage_per_day = interest_settings.service_charge_percentage / 360;
    const interest_rate_percentage_per_day = interest_settings.interest_percentage / 360;
    const penalty_rate_percentage_per_day = interest_settings.penalty_percentage / 360;
    let update_disbursements = {};
    let money_left = param.amount;

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
            } else {
                update_disbursements[e.id] = {
                    total_paid_interest_amount: e.total_paid_interest_amount + paid_interest,
                    paid_amount: e.paid_amount,
                    due_amount: e.due_amount
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

        const interests = await knex("cr_disbursement_wise_interest_fi")
            .innerJoin("cr_credit_disbursements_fi","cr_disbursement_wise_interest_fi.id_cr_credit_disbursement_fi","cr_credit_disbursements_fi.id")
            .whereIn("cr_disbursement_wise_interest_fi.id_cr_credit_disbursement_fi", cr_disbursement_ids)
            .where("is_current_transaction", 1)
            .whereNot("cr_credit_disbursements.due_amount",0);
        let insert_arr = [];
        let update_interest_ids = [];
        for (let index = 0; index < interests.length; index++) {
            const e = interests[index];
            if (e.id_cr_credit_disbursement_fi in insert_interest) {

                if (e.due_amount != insert_interest[e.id_cr_credit_disbursement]['due_amount']) {
                    update_interest_ids.push(e.id);
                    insert_arr.push({
                        id_cr_credit_disbursement_fi: e.id_cr_credit_disbursement_fi,
                        due_amount: insert_interest[e.id_cr_credit_disbursement_fi]['due_amount'],
                        sys_total_days: e.sys_total_days,
                        interest_rate_percentage: interest_rate_percentage_per_day,
                        penalty_rate_percentage : penalty_rate_percentage_per_day,
                        service_charge_rate_percentage: service_charge_percentage_per_day
                    })
                }
            }
        }
        var batchUpdate = await batchInsertUpdate(param,update_disbursements,insert_arr,update_interest_ids);
    }
}

const batchInsertUpdate = function (req,update_disbursements,insert_arr,update_interest_ids) {
    return knex.transaction(trx=>{
        const queries = [];
        // var query = knex("cr_credit_payments").insert({
        //     id_outlet:req.outlet_id,
        //     paid_amount:req.credit_payment,
        //     sys_date:new Date(),
        //     created_by:req.created_by
        // }).transacting(trx);
        // queries.push(query);
        var current_balance_incremnt = 0;
        var total_interest_paid = 0;
        var total_due = 0;
        for (const [key, value] of Object.entries(update_disbursements)) {
            current_balance_incremnt += value.paid_amount;
            total_interest_paid += value.total_paid_interest_amount;
            total_due += value.due_amount;
            var q= knex("cr_credit_disbursements_fi").where("id",key).update({
                paid_amount:value.paid_amount,
                due_amount:value.due_amount,
                total_paid_interest_amount:value.total_paid_interest_amount
            }).transacting(trx);
            queries.push(q);
        }
        var q = knex("cr_disbursement_wise_interest_fi").whereIn("id_cr_credit_disbursement_fi",update_interest_ids).update({
            is_current_transaction:0
        }).transacting(trx);
        queries.push(q);

        var qr=  knex("cr_disbursement_wise_interest_fi").insert(insert_arr).transacting(trx);
        queries.push(qr);
        Promise.all(queries).then(trx.commit).catch(trx.rollback);
    })
}

module.exports = cbl;