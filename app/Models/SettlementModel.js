const { sendApiResult } = require("../controllers/helperController");
const knex = require('../config/database');
const { where } = require("../config/database");
require('dotenv').config();

Settlement = function () { };

Settlement.getCreditListForDisbursement = function (req) {
    return new Promise(async (resolve, reject) => {
        try {            
            const data = await knex("cr_credit_disbursements")
                            .leftJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
                            .leftJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "cr_credit_disbursements.id_outlet")
                            .leftJoin("distributorspoint", "cr_retail_limit.id_point", "distributorspoint.id")
                            .whereIn("distributorspoint.dsid", req.dh_id)
                            .where("cr_credit_disbursements.sys_date", req.date)
                            .where(function() {
                                if (req.search_param) {
                                    this.where('cr_retail_limit.acc_no', req.search_param).orWhere('retailers.retailer_code', req.search_param)
                                }                                
                            })
                            // .modify(function(queryBuilder) {
                            //     if (req.acc_no) {
                            //         queryBuilder.where('cr_retail_limit.acc_no', req.acc_no);
                            //     }
                            //     if (req.outlet_code) {
                            //         queryBuilder.where('retailers.retailer_code', req.outlet_code);
                            //     }
                            // })  
                            .select("cr_credit_disbursements.id",
                                    "retailers.name",
                                    "retailers.retailer_code",
                                    "retailers.owner",
                                    "cr_retail_limit.phone",
                                    knex.raw(`DATE_FORMAT(cr_credit_disbursements.sys_date, "%d %b %y") as sys_date`),
                                    knex.raw(`distributorspoint.name as dh_name`),
                                    "cr_credit_disbursements.credit_amount",
                                    "cr_retail_limit.acc_no");
            if(data == 0) reject(sendApiResult(false,"Not found."));

            var total_amount = 0;
            for (let i = 0; i < data.length; i++) {
                total_amount += parseFloat(data[i].credit_amount)                
            }
            
            data.total_amount = total_amount.toFixed(2);

            resolve(sendApiResult(true, "Data fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.creditDisbursementRequestByDh = function (req) {
    return new Promise(async (resolve, reject) => {
        try {            
            const check = await knex("cr_credit_disbursement_histories")
                            .where("cr_credit_disbursement_histories.dh_id", req.dh_id)
                            .where("cr_credit_disbursement_histories.sys_date", req.date)
                            .count({ total: '*' }).first();

            if(check.total != 0) {
                const checkRejected = await knex("cr_disbursment_transactions")
                                        .where("cr_disbursment_transactions.dh_id", req.dh_id)
                                        .where("cr_disbursment_transactions.sys_date", req.date)
                                        .where("cr_disbursment_transactions.status", "Rejected")
                                        .count({ total: '*' }).first();
                if (checkRejected.total != 0) {
                    const updateTns = await knex("cr_disbursment_transactions")
                                        .where("cr_disbursment_transactions.dh_id", req.dh_id)
                                        .where("cr_disbursment_transactions.sys_date", req.date)
                                        .update({
                                            "status": "Requested"
                                        });
                    resolve(sendApiResult(true, "Disbursement request successfull", updateTns));
                }else{
                    reject(sendApiResult(false,"Disbursement request already submitted for selected day"));
                }                
            }else{
                var insert;
                await knex.transaction(async trx =>{      
                    var sql = 'INSERT INTO cr_credit_disbursement_histories (id_outlet,credit_amount,sys_date,fi_date,paid_amount,due_amount,total_interest_amount,total_paid_interest_amount, created_by, dh_id)';
                    sql += ' SELECT cr_credit_disbursements.id_outlet,cr_credit_disbursements.credit_amount,cr_credit_disbursements.sys_date,cr_credit_disbursements.fi_date,cr_credit_disbursements.paid_amount,cr_credit_disbursements.due_amount,cr_credit_disbursements.total_interest_amount,cr_credit_disbursements.total_paid_interest_amount, '+ req.user_id +', '+ req.dh_id +' FROM cr_credit_disbursements';
                    sql += ' LEFT JOIN cr_retail_limit ON cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet'
                    sql += ' LEFT JOIN distributorspoint ON cr_retail_limit.id_point = distributorspoint.id'
                    sql += ' WHERE cr_credit_disbursements.sys_date = \'' + req.date + '\' AND distributorspoint.dsid = ' + req.dh_id;
                    insert = await trx.raw(sql);

                    if(insert == 0){
                        reject(sendApiResult(false,"Not found."));
                    }else {
                        sql = 'INSERT INTO cr_disbursment_transactions (dh_id, dh_acc_no, amount, sys_date)'
                        sql += ' SELECT cr_credit_disbursement_histories.dh_id, cr_dh_fi.dh_acc_no, SUM(cr_credit_disbursement_histories.credit_amount), cr_credit_disbursement_histories.sys_date'
                        sql += ' FROM cr_credit_disbursement_histories';
                        sql += " LEFT JOIN cr_dh_fi ON cr_dh_fi.id_dh = cr_credit_disbursement_histories.dh_id AND cr_dh_fi.activation_status = 'Active'"
                        sql += ' WHERE cr_credit_disbursement_histories.sys_date = \'' + req.date + '\' AND cr_credit_disbursement_histories.dh_id = ' + req.dh_id;
                        sql += ' GROUP BY cr_credit_disbursement_histories.dh_id, cr_dh_fi.dh_acc_no, cr_credit_disbursement_histories.sys_date'

                        const insertTnx = await trx.raw(sql);
                        const tnxId = await trx("cr_disbursment_transactions")
                                                .where("dh_id", req.dh_id)
                                                .where("sys_date", req.date).first();

                        const updateHistory = await trx("cr_credit_disbursement_histories")
                                                    .where("dh_id", req.dh_id)
                                                    .where("sys_date", req.date)
                                                    .update({"id_disb_tnx": tnxId.id})

                        if(insertTnx == 0 || updateHistory == 0) reject(sendApiResult(false,"Not found."));
                    }
                    
                })
                

                resolve(sendApiResult(true, "Disbursement request successfull", insert));
            }
            
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.requestedDisbursementsByDh = function (req) { 
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex("cr_disbursment_transactions")
                            .leftJoin("company", "company.id", "cr_disbursment_transactions.dh_id")
                            .leftJoin("cr_dh_fi", "cr_dh_fi.id_dh", "cr_disbursment_transactions.dh_id")
                            .whereIn("cr_disbursment_transactions.dh_id", req.dh_id)                           
                            .where(function() {
                                if (req.search_param) {
                                    var search_param = req.search_param.toLowerCase().replace(/\s/g, '');
                                    this.whereRaw(`LOWER(REPLACE(company.name, ' ', '')) LIKE '%${search_param}%'`)
                                } 
                                if (req.dates) {
                                    this.whereBetween('cr_disbursment_transactions.sys_date', [req.dates.date_from, req.dates.date_to]);
                                }                               
                            })
                            .select("cr_disbursment_transactions.id",
                                    knex.raw(`company.name as dh_name`),
                                    "cr_dh_fi.dh_acc_no",
                                    "cr_disbursment_transactions.amount",
                                    "cr_disbursment_transactions.status",
                                    knex.raw('CONCAT(\''+process.env.APP_URL + '\',' + '\'/download/tnx_uploads/\','+'cr_disbursment_transactions.attachment) as attachment'),
                                    knex.raw(`DATE_FORMAT(cr_disbursment_transactions.sys_date, "%d %b %y") as sys_date`));
            
            if(data == 0) reject(sendApiResult(false,"Not found."));

            resolve(sendApiResult(true, "Data fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.getCreditListForFiDisbursement = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex("cr_disbursment_transactions")
                            .leftJoin("company", "company.id", "cr_disbursment_transactions.dh_id")
                            .leftJoin("cr_dh_fi", "cr_dh_fi.id_dh", "cr_disbursment_transactions.dh_id")                            
                            .where("cr_disbursment_transactions.status", "Requested")
                            .where(function() {
                                if (req.search_param) {
                                    var search_param = req.search_param.toLowerCase().replace(/\s/g, '');
                                    this.whereRaw(`LOWER(REPLACE(company.name, ' ', '')) LIKE '%${search_param}%'`)
                                }            
                                if (req.date) {
                                    this.where("cr_disbursment_transactions.sys_date", req.date)
                                }     
                                if (req.dh_id) {
                                    this.whereIn("cr_disbursment_transactions.dh_id", req.dh_id);
                                }
                            })
                            .select("cr_disbursment_transactions.id",
                                    knex.raw(`company.name as dh_name`),
                                    "cr_dh_fi.dh_acc_no",
                                    "cr_disbursment_transactions.amount",
                                    "cr_disbursment_transactions.status",
                                    knex.raw('CONCAT(\''+process.env.APP_URL + '\',' + '\'/download/tnx_uploads/\','+'cr_disbursment_transactions.attachment) as attachment'),
                                    knex.raw(`DATE_FORMAT(cr_disbursment_transactions.sys_date, "%d %b %y") as sys_date`));
            
            if(data == 0) reject(sendApiResult(false,"Not found."));

            resolve(sendApiResult(true, "Data fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Settlement.getTransactionDisbursementDetails = function (req) { 
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex("cr_credit_disbursement_histories")
                            .leftJoin("retailers", "retailers.id", "cr_credit_disbursement_histories.id_outlet")
                            .leftJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "cr_credit_disbursement_histories.id_outlet")
                            .leftJoin("cr_disbursment_transactions", "cr_disbursment_transactions.id", "cr_credit_disbursement_histories.id_disb_tnx")
                            //.where("cr_disbursment_transactions.dh_id", req.dh_id)
                            //.where("cr_disbursment_transactions.sys_date", req.date)
                            //.where("cr_disbursment_transactions.status", "Requested")
                            .where("cr_disbursment_transactions.id", req.id)
                            .where(function() {
                                if (req.search_param) {
                                    this.where('cr_retail_limit.acc_no', req.search_param).orWhere('retailers.retailer_code', req.search_param)
                                }                                
                            })
                            .select("cr_credit_disbursement_histories.id",
                                    "retailers.name",
                                    "retailers.retailer_code",
                                    "retailers.owner",
                                    "cr_retail_limit.phone",
                                    knex.raw(`DATE_FORMAT(cr_credit_disbursement_histories.sys_date, "%d %b %y") as sys_date`),
                                    "cr_credit_disbursement_histories.credit_amount",
                                    "cr_retail_limit.acc_no",
                                    knex.raw(`cr_retail_limit.credit_amount as approved_limit`),
                                    "cr_retail_limit.total_due",
                                    knex.raw(`(cr_retail_limit.credit_amount - total_due) as available_limit`));
            if(data == 0) reject(sendApiResult(false,"Not found."));

            var total_amount = 0;
            for (let i = 0; i < data.length; i++) {
                total_amount += parseFloat(data[i].credit_amount)                
            }
            
            data.total_amount = total_amount.toFixed(2);

            resolve(sendApiResult(true, "Data fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.raiseDhIssue = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const updateHistory = await knex("cr_disbursment_transactions")
                        .where("id", req.id)
                        .where("status", "Disbursed")
                        .update({
                            status: "Issue Raised",
                            issue_raised_by: req.user_id,
                            issue_comments: req.issue_comment
                        });
            if(updateHistory == 0) reject(sendApiResult(false,"Not found."));

            resolve(sendApiResult(true, "Issue raised successfully", updateHistory));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.creditDisburseByFi = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            var update, updateDisbursementHistories;
            await knex.transaction(async trx =>{ 

                update = await trx("cr_disbursment_transactions")
                        .where("id", req.body.id)
                        .update({
                            transaction_number: req.body.transaction_number,
                            attachment: (typeof req.file !== 'undefined') ? req.file.filename : null,
                            status : "Disbursed"
                        });

                updateDisbursementHistories = await trx("cr_credit_disbursement_histories")
                        .where("id_disb_tnx", req.body.id)
                        .update({
                            fi_date : knex.raw(`(SELECT DATE_FORMAT(NOW(),"%Y-%m-%d"))`)
                        });
                const disbursementHistoryInfo = await trx("cr_credit_disbursement_histories")
                        .distinct()
                        .select("id_outlet", "credit_amount")
                        .where("id_disb_tnx", req.body.id);

                for (let i = 0; i < disbursementHistoryInfo.length; i++) {
                    const element = disbursementHistoryInfo[i];
                    var retailerInfo = await trx("retailers")
                                        .where("id", element.id_outlet)
                                        .select("dpid").first();
                    let param = {
                        dpid: retailerInfo.dpid,
                        requested_credit: element.credit_amount,
                        outlet_id: element.id_outlet,
                        created_by: req.body.user_id
                    }
                    let doActions = await doFiDisbursementInterestActions(param, trx);
                }

                if(update == 0) reject(sendApiResult(false,"Not found."));
            });

            resolve(sendApiResult(true, "Credit disbursed successfully", update));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

const doFiDisbursementInterestActions = async function (param, trx) { 
    const interest_settings = await knex("cr_interest_settings")
                            .where("id_point", param.dpid)
                            .where("activation_status", "Active").first();

    const service_charge_percentage_per_day = interest_settings.service_charge_percentage / 360;
    const interest_rate_percentage_per_day = interest_settings.interest_percentage / 360;
    const penalty_rate_percentage_per_day = interest_settings.penalty_percentage / 360;
    const disbursement_id = await trx("cr_credit_disbursements_fi").insert({
        id_outlet: param.outlet_id,
        credit_amount: param.requested_credit,
        sys_date: new Date(),
        due_amount: param.requested_credit,
        created_by: param.created_by,
    });
    if (disbursement_id == 0) throw new Error("Credit Disbursement Not Inserted");

    const disbursement_interest_insert = await trx("cr_disbursement_wise_interest_fi").insert({
        id_cr_credit_disbursement_fi: disbursement_id[0],
        due_amount: param.requested_credit,
        interest_rate_percentage: interest_rate_percentage_per_day,
        service_charge_rate_percentage: service_charge_percentage_per_day,
        penalty_rate_percentage : penalty_rate_percentage_per_day,
        created_by: param.created_by
    });
    if (disbursement_interest_insert == 0) throw new Error("Error Occurred When inserting Credit Request");
}

Settlement.creditRejectByFi = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            var update;
            await knex.transaction(async trx =>{ 

                update = await trx("cr_disbursment_transactions")
                        .where("id", req.body.id)
                        .update({
                            status : "Rejected",
                            rejection_reason: req.body.rejectionReason
                        });
                if(update == 0) reject(sendApiResult(false,"Not found."));
            });

            resolve(sendApiResult(true, "Credit rejected successfully", update));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.collectionSettlementListForDh = function (req) {
    return new Promise(async (resolve, reject) => {
        try {            
            const data = await knex("cr_credit_payments")
                            .leftJoin("retailers", "retailers.id", "cr_credit_payments.id_outlet")
                            .leftJoin("distributorspoint", "retailers.dpid", "distributorspoint.id")
                            .leftJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "cr_credit_payments.id_outlet")
                            .where("cr_credit_payments.sys_date", req.date)  
                            .where("distributorspoint.dsid", req.dh_id)
                            .select("cr_credit_payments.id",
                                    "retailers.name",
                                    "retailers.retailer_code",
                                    "retailers.owner",
                                    "cr_retail_limit.phone",
                                    knex.raw(`DATE_FORMAT(cr_credit_payments.sys_date, "%d %b %y") as sys_date`),
                                    "cr_credit_payments.paid_amount",
                                    "cr_retail_limit.acc_no");
            if(data == 0) reject(sendApiResult(false,"Not found."));

            var total_amount = 0;
            for (let i = 0; i < data.length; i++) {
                total_amount += parseFloat(data[i].paid_amount)                
            }
            
            data.total_amount = total_amount;

            resolve(sendApiResult(true, "Data fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.collectionSettlementRequestByDh = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            var insertTnx, updateHistory, dh_acc_no;
            await knex.transaction(async trx =>{
                const check = await knex("cr_credit_payment_histories")
                                .leftJoin("cr_payment_transactions", "cr_payment_transactions.id", "cr_credit_payment_histories.id_pay_tnx")
                                .where("cr_credit_payment_histories.dh_id", req.body.dh_id)
                                .where("cr_credit_payment_histories.sys_date", req.body.date)
                                .whereNot("cr_payment_transactions.status", "Rejected")
                                .count({ total: '*' }).first();

                if(check.total != 0) {
                    reject(sendApiResult(false,"Settlement request already sent for selected day"));
                }else{
                    const checkRejected = await knex("cr_credit_payment_histories")
                                .leftJoin("cr_payment_transactions", "cr_payment_transactions.id", "cr_credit_payment_histories.id_pay_tnx")
                                .where("cr_credit_payment_histories.dh_id", req.body.dh_id)
                                .where("cr_credit_payment_histories.sys_date", req.body.date)
                                .where("cr_payment_transactions.status", "Rejected")
                                .count({ total: '*' }).first();
                    if(checkRejected.total != 0) {
                        const updateRejected = await knex("cr_payment_transactions")
                                .where("cr_payment_transactions.dh_id", req.body.dh_id)
                                .where("cr_payment_transactions.sys_date", req.body.date)
                                .where("cr_payment_transactions.status", "Rejected")
                                .update({
                                    status: 'Requested',
                                    rejected_by: null,
                                    rejection_reason: null
                                });
                        if(updateRejected == 0) reject(sendApiResult(false,"Not found."));
                    }else{                    
                        const dh_fi_info = await trx("cr_dh_fi").where({"id_dh": req.body.dh_id, "activation_status": 'Active'}).first(); 
                        dh_acc_no = dh_fi_info ? dh_fi_info.dh_acc_no : null;
                        insertTnx = await trx("cr_payment_transactions")
                                .insert({
                                    transaction_number: typeof req.body.transaction_number !== 'undefined' ? req.body.transaction_number : null,
                                    attachment: req.file ? req.file.filename : null,
                                    dh_acc_no: dh_acc_no,
                                    dh_id: typeof req.body.dh_id !== 'undefined' ? req.body.dh_id : null,
                                    amount: typeof req.body.total_amount !== 'undefined' ? req.body.total_amount : 0,
                                    sys_date: req.body.date
                                });
                                
                        var sql = 'INSERT INTO cr_credit_payment_histories (dh_id,id_pay_tnx,id_outlet,paid_amount,sys_date,fi_date,created_by)';
                        sql += ' SELECT '+ req.body.dh_id +','+insertTnx[0]+',cr_credit_payments.id_outlet,cr_credit_payments.paid_amount,cr_credit_payments.sys_date,cr_credit_payments.fi_date,'+req.body.user_id+' FROM cr_credit_payments';
                        sql += ' LEFT JOIN cr_retail_limit ON cr_credit_payments.id_outlet = cr_retail_limit.id_outlet'
                        sql += ' LEFT JOIN distributorspoint ON cr_retail_limit.id_point = distributorspoint.id'
                        sql += ' WHERE cr_credit_payments.sys_date = \'' + req.body.date + '\' AND distributorspoint.dsid = ' + req.body.dh_id;

                        const insert = await knex.raw(sql);
                        if(insert == 0) reject(sendApiResult(false,"Not found."));
                    }
                }                
            });

            resolve(sendApiResult(true, "Request sent successfully", updateHistory));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.requestedCollectionsByDh = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex("cr_payment_transactions")
                            .leftJoin("company", "company.id", "cr_payment_transactions.dh_id")
                            .leftJoin("cr_dh_fi", "cr_dh_fi.id_dh", "cr_payment_transactions.dh_id")
                            .whereIn("cr_payment_transactions.dh_id", req.dh_id)                           
                            .where(function() {
                                this.where('cr_payment_transactions.amount', '>', 0);
                                if (req.search_param) {
                                    var search_param = req.search_param.toLowerCase().replace(/\s/g, '');
                                    this.whereRaw(`LOWER(REPLACE(company.name, ' ', '')) LIKE '%${search_param}%'`)
                                } 
                                if (req.dates) {
                                    this.whereBetween('cr_payment_transactions.sys_date', [req.dates.date_from, req.dates.date_to]);
                                }    
                                if (req.date) {
                                    this.where('cr_payment_transactions.sys_date', req.date);
                                }                           
                            })
                            .select("cr_payment_transactions.id",
                                    knex.raw(`company.name as dh_name`),
                                    "cr_dh_fi.dh_acc_no",
                                    "cr_payment_transactions.amount",
                                    "cr_payment_transactions.status",
                                    knex.raw('CONCAT(\''+process.env.APP_URL + '\',' + '\'/download/tnx_uploads/\','+'cr_payment_transactions.attachment) as attachment'),
                                    knex.raw(`DATE_FORMAT(cr_payment_transactions.sys_date, "%d %b %y") as sys_date`));
            
            if(data == 0) reject(sendApiResult(false,"Not found."));

            resolve(sendApiResult(true, "Data fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.collectionSettlementListForFi = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex("cr_payment_transactions")
                            .leftJoin("company", "company.id", "cr_payment_transactions.dh_id")
                            .leftJoin("cr_dh_fi", "cr_dh_fi.id_dh", "cr_payment_transactions.dh_id")
                            .where("cr_payment_transactions.dh_id", req.dh_id)
                            .where("cr_payment_transactions.status", "Requested")                           
                            .where(function() {
                                if (req.search_param) {
                                    var search_param = req.search_param.toLowerCase().replace(/\s/g, '');
                                    this.whereRaw(`LOWER(REPLACE(company.name, ' ', '')) LIKE '%${search_param}%'`)
                                } 
                                if (req.date) {
                                    this.where("cr_payment_transactions.sys_date", req.date)
                                }                               
                            })
                            .select("cr_payment_transactions.id",
                                    knex.raw(`company.name as dh_name`),
                                    "cr_dh_fi.dh_acc_no",
                                    "cr_payment_transactions.amount",
                                    "cr_payment_transactions.status",
                                    "cr_payment_transactions.attachment",
                                    knex.raw(`DATE_FORMAT(cr_payment_transactions.sys_date, "%d %b %y") as sys_date`));
            
            if(data == 0) reject(sendApiResult(false,"Not found."));

            resolve(sendApiResult(true, "Data fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.collectionSettlementConfirmByFi = function (req) { 
    return new Promise(async (resolve, reject) => {
        try {
            const updateHistory = await knex('cr_payment_transactions')
                                .where({
                                    "id" : req.id,
                                    "status" : "Requested"                                    
                                })
                                .update({
                                    "status" : "Confirmed"
                                });

            const updateDisbursementHistories = await knex("cr_credit_payment_histories")
                        .where("id_pay_tnx", req.id)
                        .update({
                            fi_date : knex.raw(`(SELECT DATE_FORMAT(NOW(),"%Y-%m-%d"))`)
                        });
            if(updateHistory == 0) reject(sendApiResult(false,"Not found."));

            const paymentHistoryInfo = await knex("cr_credit_payment_histories")
                        .distinct()
                        .select("id_outlet", "paid_amount")
                        .where("id_pay_tnx", req.id);

            for (let i = 0; i < paymentHistoryInfo.length; i++) {
                const element = paymentHistoryInfo[i];
                var retailerInfo = await knex("retailers")
                                    .where("id", element.id_outlet)
                                    .select("dpid").first();
                let param = {
                    dpid: retailerInfo.dpid,
                    credit_payment: element.paid_amount,
                    outlet_id: element.id_outlet,
                    created_by: req.user_id
                }
                let doActions = await doFiSettlementActions(param);
            }

            resolve(sendApiResult(true, "Confirmed successfully", updateHistory));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

const doFiSettlementActions = async function (param) { 
    const disbursements = await knex("cr_credit_disbursements_fi")
                .where("id_outlet", param.outlet_id)
                .whereNot("due_amount", 0)
                .where("activation_status", "Active");
    const interest_settings = await knex("cr_interest_settings").where("id_point", param.dpid).where("activation_status", "Active").first();

    const service_charge_percentage_per_day = interest_settings.service_charge_percentage / 360;
    const interest_rate_percentage_per_day = interest_settings.interest_percentage / 360;
    const penalty_rate_percentage_per_day = interest_settings.penalty_percentage / 360;
    let update_disbursements = {};
    let money_left = param.credit_payment;

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
            .whereNot("cr_credit_disbursements_fi.due_amount",0);
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
                        service_charge_rate_percentage: service_charge_percentage_per_day,
                        created_by: param.created_by
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

Settlement.collectionSettlementRejectFi = function (req){
    return new Promise(async (resolve, reject) => {
        try {
            const updateHistory = await knex('cr_payment_transactions')
                                .where({
                                    "id" : req.historyId,
                                    "status" : "Requested"                                    
                                })
                                .update({
                                    "status" : "Rejected",
                                    "rejected_by" : req.user_id,
                                    "rejection_reason" : req.rejection_reason,
                                });
            if(updateHistory == 0) reject(sendApiResult(false,"Not found."));

            resolve(sendApiResult(true, "Rejected successfully", updateHistory));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.getCollectionSettlementDetails = function (req) { 
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex("cr_credit_payment_histories")
                            .leftJoin("retailers", "retailers.id", "cr_credit_payment_histories.id_outlet")
                            .leftJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "cr_credit_payment_histories.id_outlet")
                            .leftJoin("cr_payment_transactions", "cr_payment_transactions.id", "cr_credit_payment_histories.id_pay_tnx")
                            .where("cr_payment_transactions.id", req.id)
                            .where(function() {
                                this.where("cr_credit_payment_histories.paid_amount", ">", 0);
                                if (req.search_param) {
                                    this.where('cr_retail_limit.acc_no', req.search_param).orWhere('retailers.retailer_code', req.search_param)
                                }                                
                            })
                            .select("cr_credit_payment_histories.id",
                                    "retailers.name",
                                    "retailers.retailer_code",
                                    "retailers.owner",
                                    "cr_retail_limit.phone",
                                    knex.raw(`DATE_FORMAT(cr_credit_payment_histories.sys_date, "%d %b %y") as sys_date`),
                                    "cr_credit_payment_histories.paid_amount",
                                    "cr_retail_limit.acc_no");
            if(data == 0) reject(sendApiResult(false,"Not found."));

            var total_amount = 0;
            for (let i = 0; i < data.length; i++) {
                total_amount += parseFloat(data[i].credit_amount)                
            }
            
            data.total_amount = total_amount.toFixed(2);

            resolve(sendApiResult(true, "Data fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.raisedIssues = function (req) { 
    return new Promise(async (resolve, reject) => {
        try {            
            const data = await knex("cr_disbursment_transactions")
                            .leftJoin("company", "company.id", "cr_disbursment_transactions.dh_id")
                            .leftJoin("cr_dh_fi", "cr_dh_fi.id_dh", "cr_disbursment_transactions.dh_id")
                            .leftJoin("cr_users", "cr_disbursment_transactions.issue_raised_by", "cr_users.id")
                            .whereIn("cr_disbursment_transactions.dh_id", req.dh_id)   
                            .where("cr_disbursment_transactions.status", "Issue Raised")                           
                            .where(function() {
                                if (req.search_param) {
                                    var search_param = req.search_param.toLowerCase().replace(/\s/g, '');
                                    this.whereRaw(`LOWER(REPLACE(company.name, ' ', '')) LIKE '%${search_param}%'`)
                                } 
                                if (req.date) {
                                    this.where("cr_disbursment_transactions.sys_date", req.date)
                                }                               
                            })
                            .select("cr_disbursment_transactions.id",
                                    knex.raw(`company.name as dh_name`),
                                    "cr_dh_fi.dh_acc_no",
                                    "cr_disbursment_transactions.issue_comments",
                                    "cr_disbursment_transactions.amount",
                                    "cr_disbursment_transactions.status",
                                    "cr_disbursment_transactions.attachment",
                                    knex.raw('CONCAT(\''+process.env.APP_URL + '\',' + '\'/download/tnx_uploads/\','+'cr_disbursment_transactions.attachment) as attachment'),
                                    knex.raw(`cr_users.name as issue_raised_by`),
                                    knex.raw(`DATE_FORMAT(cr_disbursment_transactions.sys_date, "%d %b %y") as sys_date`));
            
            if(data == 0) reject(sendApiResult(false,"Not found."));

            resolve(sendApiResult(true, "Data fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.resolveIssue = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const updateHistory = await knex('cr_disbursment_transactions')
                                .where({
                                    "id" : req.id,
                                    "status" : "Issue Raised"                                    
                                })
                                .update({
                                    "status" : "Disbursed"
                                });
            if(updateHistory == 0) reject(sendApiResult(false,"Not found."));

            resolve(sendApiResult(true, "Confirmed successfully", updateHistory));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Settlement.getDhAccNo = function (dh_id) { 
    return new Promise(async (resolve, reject) => {
        try {            
            const data = await knex("cr_dh_fi")
                            .where("id_dh", dh_id)
                            .select("dh_acc_no").first();

            if(data == 0) reject(sendApiResult(false,"Not found."));

            resolve(sendApiResult(true, "Data fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

module.exports = Settlement;