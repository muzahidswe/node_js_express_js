const { sendApiResult, timeout, getFiBaseDpids, createExcle, generateBlobDownloadURL } = require("../controllers/helperController");
const knex = require('../config/database');
var moment = require('moment');
const excel = require('excel4node');
const fs = require('fs');
var ExcelJs = require('exceljs');
const { keyBy } = require("lodash");
const axios = require("axios");
let ReportModel = function () {
};

ReportModel.bulkSalesUpload = function (resData, req) {
    return new Promise(async (resolve, reject) => {
        try {
            await knex.transaction(async trx => {

                let iterator = Object.keys(resData[0]);
                //console.log(iterator)
                // let separateYear = iterator[14].split('-');
                // let Year = '20' + separateYear[1];
                var date = new Date();
                var currentMnth = date.getMonth();
                let months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                let monthsInExcel = [];
                for (let i = currentMnth; i <= 11; i++) {
                    monthsInExcel.push(months[i]);
                }
                for (let i = 0; i < currentMnth; i++) {
                    monthsInExcel.push(months[i]);
                }
                console.log(monthsInExcel)
                let masterArray = [];

                for (let index = 0; index < resData.length; index++) {

                    const retailObj = await knex
                        .select(
                            'r.id',
                            'r.rtid',
                            'ru.dsid',
                            'r.dpid'
                        )
                        .from('retailers AS r')
                        .leftJoin('routes AS ru', 'ru.id', 'r.rtid')
                        .where('r.stts', '=', 1)
                        .where('r.retailer_code', '=', resData[index]['Outlet code'])
                        .first();

                    console.log(retailObj);
                    var firstMnthIndexInExcel = 14;
                    monthsInExcel.forEach((k, v) => {

                        let monthColumn = k + '-' + iterator[firstMnthIndexInExcel].split('-')[1];

                        let Year = '20' + iterator[firstMnthIndexInExcel].split('-')[1];
                        firstMnthIndexInExcel++;
                        let month = arraySearch(months, k) + 1;
                        let top_sales = 0;
                        if (resData[index][monthColumn] != '') {
                            top_sales = resData[index][monthColumn];
                        }

                        //if(typeof retailObj !== 'undefined' && retailObj.id && retailObj.dsid){
                        let rowData = {
                            year: Year,
                            top_sale_amount: top_sales,
                            month: month,
                            id_point: typeof retailObj !== 'undefined' ? retailObj.dpid : null,
                            id_outlet: typeof retailObj !== 'undefined' ? retailObj.id : null,
                            id_dh: typeof retailObj !== 'undefined' ? retailObj.dsid : null,
                            region: resData[index]['Region'],
                            area: resData[index]['Area'],
                            distribution_house: resData[index]['Distribution House'],
                            territory: resData[index]['Territory'],
                            point: resData[index]['Point'],
                            route_section: resData[index]['Route/Section'],
                            route: resData[index]['Route'],
                            section: resData[index]['Section'],
                            outlet_code: resData[index]['Outlet code'],
                            owner_name: resData[index]['Owner name'],
                            outlet_name: resData[index]['Outlet name'],
                            contact: resData[index]['Contact'],
                            address: resData[index]['Address']
                        };
                        masterArray.push(rowData);
                        //}
                    });
                }

                if (masterArray.length === 0) {
                    resolve(sendApiResult(false, "No data found."));
                } else {
                    const insert = await trx.batchInsert("cr_sales_history", masterArray, 50);

                    if (insert == 0) reject(sendApiResult(false, "Server Error", masterArray));

                    let msg = "File imported successfully!";

                    resolve(sendApiResult(true, msg, insert));
                }
            }).then((result) => {
                resolve(sendApiResult(true, result));
            }).catch((error) => {
                reject(sendApiResult(false, "Data not inserted."));
                console.log(error)
            });
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    }).catch((error) => {
        console.log(error, 'Promise error');
    });
}

const arraySearch = (arr, val) => {
    for (var i = 0; i < arr.length; i++)
        if (arr[i] === val)
            return i;
    return false;
}

ReportModel.disbursements = async (req, res) => {
    var url = require('url');
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var dpids = req.body.dpids;
    var fromDate = req.body.dateFrom ? req.body.dateFrom : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
    var toDate = req.body.dateTo ? req.body.dateTo : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
    var filterText = req.body.filterText;
    console.log(fromDate)
    console.log(toDate)
    return new Promise(async (resolve, reject) => {
        try {
            var scopeOutlets = await knex("cr_retail_limit")
                .select(
                    "cr_retail_limit.id",
                    "cr_retail_limit.outlet_code",
                    "cr_retail_limit.outlet_name",
                    "cr_retail_limit.owner_name",
                    "cr_retail_limit.phone",
                    "cr_retail_limit.address",
                    knex.raw("distributorspoint.name as dp_name"),
                    knex.raw("company.name as dh_name"),
                    //knex.raw(`sum(cr_credit_disbursements.credit_amount) as credit_amount`),
                    'cr_credit_disbursements.credit_amount',
                    'cr_credit_disbursements.invoice_amount',
                    'cr_credit_disbursements.cash_payment',
                    knex.raw(`DATE_FORMAT(cr_credit_disbursements.sys_date, "%d-%b-%Y") as sys_date`)
                )
                .innerJoin("distributorspoint", "distributorspoint.id", "cr_retail_limit.id_point")
                .innerJoin("company", "distributorspoint.dsid", "company.id")
                .leftJoin("cr_credit_disbursements", "cr_credit_disbursements.id_outlet", "cr_retail_limit.id_outlet")
                .where(function () {
                    this.whereIn("cr_retail_limit.id_point", dpids);
                    this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);
                    if (filterText) {
                        var search_param = filterText.toLowerCase().replace(/\s/g, '');
                        this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                    }
                })
                //.whereNotIn("cr_retail_limit.id_point", [334,344])
                // .where(function() {
                //     this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);
                //     this.orWhereBetween('cr_retail_limit.end_date', [fromDate, toDate]);
                // })
                //.where("cr_retail_limit.kyc_status", "Initial")
                .where("cr_retail_limit.activation_status", "Active")
                .orderBy("cr_retail_limit.id_outlet", "cr_credit_disbursements.sys_date")
                // .groupBy("cr_retail_limit.id_outlet")
                .paginate({
                    perPage: query.per_page,
                    currentPage: query.page,
                    isLengthAware: true
                });
            if (scopeOutlets == 0) resolve(sendApiResult(false, "Data not found", scopeOutlets));
            var scopeOutletsForTotal = await knex("cr_retail_limit")
                .select(
                    knex.raw(`sum(cr_credit_disbursements.credit_amount) as total`)
                )
                .leftJoin("cr_credit_disbursements", "cr_credit_disbursements.id_outlet", "cr_retail_limit.id_outlet")
                .where(function () {
                    this.whereIn("cr_retail_limit.id_point", dpids);
                    this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);
                    if (filterText) {
                        var search_param = filterText.toLowerCase().replace(/\s/g, '');
                        this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                    }
                })
                .whereNotIn("cr_retail_limit.id_point", [334, 344])
                .where("cr_retail_limit.activation_status", "Active")
                .orderBy("cr_retail_limit.id_outlet", "cr_credit_disbursements.sys_date")
                .first();
            var totalAmount = !isNaN(scopeOutletsForTotal.total) ? parseFloat(scopeOutletsForTotal.total) : 0.00;
            scopeOutlets.total_amount = totalAmount.toFixed(2);
            resolve(sendApiResult(true, "Data successfully fetched.", scopeOutlets));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

ReportModel.payments = async (req, res) => {
    var url = require('url');
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var dpids = req.body.dpids;
    var fromDate = req.body.dateFrom ? req.body.dateFrom : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
    var toDate = req.body.dateTo ? req.body.dateTo : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
    var filterText = req.body.filterText;
    console.log(fromDate)
    console.log(toDate)
    return new Promise(async (resolve, reject) => {
        try {
            var scopeOutlets = await knex("cr_retail_limit")
                .select(
                    "cr_retail_limit.id",
                    "cr_retail_limit.outlet_code",
                    "cr_retail_limit.outlet_name",
                    "cr_retail_limit.owner_name",
                    "cr_retail_limit.phone",
                    "cr_retail_limit.address",
                    knex.raw("distributorspoint.name as dp_name"),
                    knex.raw("company.name as dh_name"),
                    knex.raw(`sum(cr_credit_payments.paid_amount) as paid_amount`),
                    knex.raw(`sum(cr_credit_payments.paid_principle) as paid_principle`),
                    knex.raw(`sum(cr_credit_payments.paid_interest_amount) as paid_interest_amount`),
                    knex.raw(`DATE_FORMAT(cr_credit_payments.sys_date , "%d %b %Y") AS sys_date`)
                )
                .innerJoin("distributorspoint", "distributorspoint.id", "cr_retail_limit.id_point")
                .innerJoin("company", "distributorspoint.dsid", "company.id")
                .leftJoin("cr_credit_payments", "cr_credit_payments.id_outlet", "cr_retail_limit.id_outlet")
                .where(function () {
                    this.whereIn("cr_retail_limit.id_point", dpids);
                    this.whereBetween('cr_credit_payments.sys_date', [fromDate, toDate]);
                    if (filterText) {
                        var search_param = filterText.toLowerCase().replace(/\s/g, '');
                        this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                    }
                })
                // .where(function() {
                //     this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);
                //     this.orWhereBetween('cr_retail_limit.end_date', [fromDate, toDate]);
                // })
                //.where("cr_retail_limit.kyc_status", "Initial")
                .where("cr_retail_limit.activation_status", "Active")
                .groupBy("cr_credit_payments.id")
                .orderBy("cr_retail_limit.id_outlet", "cr_credit_disbursements.sys_date")
                .paginate({
                    perPage: query.per_page,
                    currentPage: query.page,
                    isLengthAware: true
                });
            if (scopeOutlets == 0) resolve(sendApiResult(false, "Data not found", scopeOutlets));
            var scopeOutletsForTotal = await knex("cr_retail_limit")
                .select(
                    knex.raw(`sum(cr_credit_payments.paid_amount) as total`)
                )
                .leftJoin("cr_credit_payments", "cr_credit_payments.id_outlet", "cr_retail_limit.id_outlet")
                .where(function () {
                    this.whereIn("cr_retail_limit.id_point", dpids);
                    this.whereBetween('cr_credit_payments.sys_date', [fromDate, toDate]);
                    if (filterText) {
                        var search_param = filterText.toLowerCase().replace(/\s/g, '');
                        this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                    }
                }).where("cr_retail_limit.activation_status", "Active").first();
            var totalAmount = parseFloat(scopeOutletsForTotal.total);
            scopeOutlets.total_amount = totalAmount.toFixed(2);
            resolve(sendApiResult(true, "Payments data fetched successfully.", scopeOutlets));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

ReportModel.dateWiseDisbPayByRoute = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            var output = {};
            const totalDisbursed = await knex("cr_credit_disbursements")
                .sum({ total_disbursed: 'cr_credit_disbursements.credit_amount' })
                .innerJoin("retailers", "retailers.retailer_code", "cr_credit_disbursements.outlet_code")
                .where("retailers.stts", 1)
                .where("retailers.rtid", req.params.route_id)
                .where("cr_credit_disbursements.sys_date", req.params.date);
            output.total_disbursed = totalDisbursed[0].total_disbursed ? totalDisbursed[0].total_disbursed : 0;
            const totalPaid = await knex("cr_credit_payments")
                .sum({ total_paid: 'cr_credit_payments.paid_amount' })
                .leftJoin("retailers", "retailers.retailer_code", "cr_credit_payments.outlet_code")
                .where("retailers.stts", 1)
                .where("retailers.rtid", req.params.route_id)
                .where("cr_credit_payments.sys_date", req.params.date);
            output.total_paid = totalPaid[0].total_paid ? totalPaid[0].total_paid : 0;
            resolve(sendApiResult(true, "Data fetched successfully", output));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

ReportModel.registrationInformation = async (req) => {
    console.log(req.routeSections)
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex("cr_retail_limit")
                //.count({total:'cr_retail_limit.*'})
                .select(
                    knex.raw(`count(cr_retail_limit.id) as scoped_outlets`),
                    knex.raw(`sum(case cr_retail_limit.doc_ready WHEN 1 THEN 1 ELSE 0 END) as documents_prepared`),
                    knex.raw(`sum(case cr_retail_limit.kyc_status WHEN 'Pending' THEN 1 ELSE 0 END) as kyc_completed`),
                    knex.raw(`sum(case cr_retail_limit.kyc_status WHEN 'Doc Submitted' THEN 1 ELSE 0 END) as doc_submitted_to_fi`),
                    knex.raw(`sum(case cr_retail_limit.kyc_status WHEN 'Rejected' THEN 1 ELSE 0 END) as doc_rejected_by_fi`),
                    knex.raw(`sum(case cr_retail_limit.limit_status WHEN 'FI Confirmed' THEN 1 ELSE 0 END) as loan_approved`),
                    knex.raw(`sum(case cr_retail_limit.loan_availed WHEN 1 THEN 1 ELSE 0 END) as loan_availed`),
                )
                .leftJoin("retailers", "retailers.id", "cr_retail_limit.id_outlet")
                .leftJoin("routes", "routes.id", "retailers.rtid")
                .leftJoin("section_days", "routes.section", "section_days.section")
                .where(function () {
                    if (req.routeSections) {
                        this.whereIn(knex.raw(`concat(routes.number,section_days.slug)`), req.routeSections)
                    }
                    if (req.dpids) {
                        this.whereIn("cr_retail_limit.id_point", req.dpids);
                    }
                })
                .where("routes.stts", 1)
                .where("cr_retail_limit.activation_status", "Active").first();
            resolve(sendApiResult(true, "Data fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

ReportModel.updateDocSubmitted = async (rows, filePath, req) => {
    return new Promise(async (resolve, reject) => {
        try {
            var outletCodes = [];
            for (let i = 0; i < rows.length; i++) {
                const e = rows[i];
                var array = Object.values(e);
                outletCodes.push(array[1])
            }
            if (outletCodes.length) {
                const update = await knex("cr_retail_limit")
                    .whereIn("outlet_code", outletCodes)
                    .update({
                        kyc_status: "Doc Submitted"
                    });
                if (update == 0) {
                    resolve(sendApiResult(false, "Nothing to update"));
                } else {
                    const insert = await knex("cr_doc_submitted_atachments")
                        .insert({
                            "attachment": filePath,
                            "created_by": req.user_id
                        });
                    resolve(sendApiResult(true, "Successfully Submitted!", update));
                }
            } else {
                resolve(sendApiResult(false, "No Outlet Found"));
            }
        } catch (error) {
            resolve(sendApiResult(false, "Something bad happened!", error));
        }
    })
}

ReportModel.creditInformation = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            var select = `DATE_FORMAT(cr_credit_disbursements.sys_date , "%d %b %Y") AS date,
                        IFNULL(
                            (
                            SELECT
                                - sum( cd.paid_amount ) - sum( cd.total_interest_amount - cd.total_paid_interest_amount ) + sum( cd.credit_amount ) + sum( cdwi.sys_service_charge_amount ) + sum( cdwi.sys_penalty_amount )
                            FROM
                                cr_credit_disbursements cd
                                LEFT JOIN cr_disbursement_wise_interest cdwi ON cd.id = cdwi.id_cr_credit_disbursement AND cdwi.is_current_transaction = 1
                                LEFT JOIN cr_retail_limit crl ON cd.id_outlet = crl.id_outlet
                                LEFT JOIN retailers rt ON rt.id = crl.id_outlet
                                LEFT JOIN routes r ON r.id = rt.rtid
                                LEFT JOIN section_days s ON r.section = s.section 
                            WHERE
                                cd.sys_date < cr_credit_disbursements.sys_date`;
            if (req.dpids) {
                select += ` AND crl.id_point IN (${req.dpids.join()})`;
            }
            if (req.routeSections) {
                select += ` AND concat( r.number, s.slug ) IN ('${req.routeSections.join("','")}')`;
            }
            select += ` ),
                            0 
                        ) AS opening_outstanding,
                        sum( cr_credit_disbursements.credit_amount - cr_credit_disbursements.paid_amount ) AS principle,
                        sum( cr_credit_disbursements.total_interest_amount - cr_credit_disbursements.total_paid_interest_amount ) AS interest,
                        sum( cr_credit_disbursements.credit_amount ) AS new_loan,
                        (
                            IFNULL(
                                (
                                SELECT
                                    - sum( cd.paid_amount ) - sum( cd.total_interest_amount - cd.total_paid_interest_amount ) + sum( cd.credit_amount ) + sum( cdwi.sys_service_charge_amount ) + sum( cdwi.sys_penalty_amount )
                                FROM
                                    cr_credit_disbursements cd
                                    LEFT JOIN cr_disbursement_wise_interest cdwi ON cd.id = cdwi.id_cr_credit_disbursement AND cdwi.is_current_transaction = 1
                                    LEFT JOIN cr_retail_limit crl ON cd.id_outlet = crl.id_outlet
                                    LEFT JOIN retailers rt ON rt.id = crl.id_outlet
                                    LEFT JOIN routes r ON r.id = rt.rtid
                                    LEFT JOIN section_days s ON r.section = s.section 
                                WHERE
                                    cd.sys_date < cr_credit_disbursements.sys_date`;
            if (req.dpids) {
                select += ` AND crl.id_point IN (${req.dpids.join()})`;
            }
            if (req.routeSections) {
                select += ` AND concat( r.number, s.slug ) IN ('${req.routeSections.join("','")}')`;
            }

            select += `),
                                0 
                            ) - sum( cr_credit_disbursements.paid_amount ) - sum( cr_credit_disbursements.total_interest_amount - cr_credit_disbursements.total_paid_interest_amount ) + sum( cr_credit_disbursements.credit_amount ) 
                        ) AS closing_blnc,
                        ( SELECT sum( crl.allowed_limit ) 
                            FROM cr_retail_limit crl
                            LEFT JOIN retailers rt ON rt.id = crl.id_outlet
                            LEFT JOIN routes r ON r.id = rt.rtid 
                            LEFT JOIN section_days s ON r.section = s.section 
                          WHERE crl.activation_status = 'Active'`;
            if (req.dpids) {
                select += ` AND crl.id_point IN (${req.dpids.join()})`;
            }
            if (req.routeSections) {
                select += ` AND concat( r.number, s.slug ) IN ('${req.routeSections.join("','")}')`;
            }
            select += `) AS max_loan_limit,
                        CONCAT(TRUNCATE((
                            (
                                (
                                    IFNULL(
                                        (
                                        SELECT
                                            - sum( cd.paid_amount ) - sum( cd.total_interest_amount - cd.total_paid_interest_amount ) + sum( cd.credit_amount ) + sum( cdwi.sys_service_charge_amount ) + sum( cdwi.sys_penalty_amount )
                                        FROM
                                            cr_credit_disbursements cd
                                            LEFT JOIN cr_disbursement_wise_interest cdwi ON cd.id = cdwi.id_cr_credit_disbursement AND cdwi.is_current_transaction = 1
                                            LEFT JOIN cr_retail_limit crl ON cd.id_outlet = crl.id_outlet
                                            LEFT JOIN retailers rt ON rt.id = crl.id_outlet
                                            LEFT JOIN routes r ON r.id = rt.rtid
                                            LEFT JOIN section_days s ON r.section = s.section 
                                        WHERE
                                            cd.sys_date < cr_credit_disbursements.sys_date`;
            if (req.dpids) {
                select += ` AND crl.id_point IN (${req.dpids.join()})`;
            }
            if (req.routeSections) {
                select += ` AND concat( r.number, s.slug ) IN ('${req.routeSections.join("','")}')`;
            }
            select += `),
                                        0 
                                    ) - sum( cr_credit_disbursements.paid_amount ) - sum( cr_credit_disbursements.total_interest_amount - cr_credit_disbursements.total_paid_interest_amount ) + sum( cr_credit_disbursements.credit_amount ) 
                                ) / ( SELECT sum( crl.allowed_limit ) 
                            FROM cr_retail_limit crl
                            LEFT JOIN retailers rt ON rt.id = crl.id_outlet
                            LEFT JOIN routes r ON r.id = rt.rtid 
                            LEFT JOIN section_days s ON r.section = s.section 
                          WHERE crl.activation_status = 'Active'`;
            if (req.dpids) {
                select += ` AND crl.id_point IN (${req.dpids.join()})`;
            }
            if (req.routeSections) {
                select += ` AND concat( r.number, s.slug ) IN ('${req.routeSections.join("','")}')`;
            }
            select += `)
                            ) * 100 
                        ),2), '%') AS utilization_rate`;
            var data = await knex("cr_credit_disbursements")
                .select(knex.raw(select))
                .leftJoin("cr_retail_limit", "cr_credit_disbursements.id_outlet", "cr_retail_limit.id_outlet")
                .leftJoin("retailers", "retailers.id", "cr_retail_limit.id_outlet")
                .leftJoin("routes", "routes.id", "retailers.rtid")
                .leftJoin("section_days", "routes.section", "section_days.section")
                .where(function () {
                    if (req.dpids) {
                        this.whereIn("cr_retail_limit.id_point", req.dpids);
                    }
                    if (req.routeSections) {
                        this.whereIn(knex.raw(`concat( routes.number, section_days.slug )`), req.routeSections);
                    }
                    if (req.fromDate) {
                        this.where("cr_credit_disbursements.sys_date", '>=', req.fromDate);
                    }
                    if (req.toDate) {
                        this.where("cr_credit_disbursements.sys_date", '<=', req.toDate);
                    }
                })
                .where("cr_retail_limit.activation_status", "Active")
                .groupBy("cr_credit_disbursements.sys_date")
                .paginate({
                    perPage: req.countPerPage,
                    currentPage: req.page,
                    isLengthAware: true
                });

            if (data == 0 || !data.data[0].date) {
                resolve(sendApiResult(false, "Data not found", []));
            }
            else {
                resolve(sendApiResult(true, "Data successfully fetched.", data));
            }

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

ReportModel.creditInformationByOutlet = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            var select = `cr_retail_limit.outlet_code,
                        IFNULL(
                            (
                            SELECT
                                - sum( cd.paid_amount ) - sum( cd.total_interest_amount - cd.total_paid_interest_amount ) + sum( cd.credit_amount ) + sum( cdwi.sys_service_charge_amount ) + sum( cdwi.sys_penalty_amount )
                            FROM
                                cr_credit_disbursements cd
                                LEFT JOIN cr_disbursement_wise_interest cdwi ON cd.id = cdwi.id_cr_credit_disbursement AND cdwi.is_current_transaction = 1
                                LEFT JOIN cr_retail_limit crl ON cd.id_outlet = crl.id_outlet
                            WHERE
                                cd.sys_date < cr_credit_disbursements.sys_date`;
            if (req.dpids) {
                select += ` AND crl.id_point IN (${req.dpids.join()})`;
            }
            if (req.selectedOutlets) {
                select += ` AND crl.id_outlet IN (${req.selectedOutlets.join()})`;
            }
            select += ` ),
                            0 
                        ) AS opening_outstanding,
                        sum( cr_credit_disbursements.credit_amount - cr_credit_disbursements.paid_amount ) AS principle,
                        sum( cr_credit_disbursements.total_interest_amount - cr_credit_disbursements.total_paid_interest_amount ) AS interest,
                        sum( cr_credit_disbursements.credit_amount ) AS new_loan,
                        (
                            IFNULL(
                                (
                                SELECT
                                    - sum( cd.paid_amount ) - sum( cd.total_interest_amount - cd.total_paid_interest_amount ) + sum( cd.credit_amount ) + sum( cdwi.sys_service_charge_amount ) + sum( cdwi.sys_penalty_amount )
                                FROM
                                    cr_credit_disbursements cd
                                    LEFT JOIN cr_disbursement_wise_interest cdwi ON cd.id = cdwi.id_cr_credit_disbursement AND cdwi.is_current_transaction = 1
                                    LEFT JOIN cr_retail_limit crl ON cd.id_outlet = crl.id_outlet
                                WHERE
                                    cd.sys_date < cr_credit_disbursements.sys_date`;
            if (req.dpids) {
                select += ` AND crl.id_point IN (${req.dpids.join()})`;
            }
            if (req.selectedOutlets) {
                select += ` AND crl.id_outlet IN (${req.selectedOutlets.join()})`;
            }

            select += `),
                                0 
                            ) - sum( cr_credit_disbursements.paid_amount ) - sum( cr_credit_disbursements.total_interest_amount - cr_credit_disbursements.total_paid_interest_amount ) + sum( cr_credit_disbursements.credit_amount ) 
                        ) AS closing_blnc,
                        cr_retail_limit.allowed_limit AS max_loan_limit,
                        CONCAT(TRUNCATE((
                            (
                                (
                                    IFNULL(
                                        (
                                        SELECT
                                            - sum( cd.paid_amount ) - sum( cd.total_interest_amount - cd.total_paid_interest_amount ) + sum( cd.credit_amount ) + sum( cdwi.sys_service_charge_amount ) + sum( cdwi.sys_penalty_amount )
                                        FROM
                                            cr_credit_disbursements cd
                                            LEFT JOIN cr_disbursement_wise_interest cdwi ON cd.id = cdwi.id_cr_credit_disbursement AND cdwi.is_current_transaction = 1
                                            LEFT JOIN cr_retail_limit crl ON cd.id_outlet = crl.id_outlet
                                        WHERE
                                            cd.sys_date < cr_credit_disbursements.sys_date`;
            if (req.dpids) {
                select += ` AND crl.id_point IN (${req.dpids.join()})`;
            }
            if (req.selectedOutlets) {
                select += ` AND crl.id_outlet IN (${req.selectedOutlets.join()})`;
            }
            select += `),
                                        0 
                                    ) - sum( cr_credit_disbursements.paid_amount ) - sum( cr_credit_disbursements.total_interest_amount - cr_credit_disbursements.total_paid_interest_amount ) + sum( cr_credit_disbursements.credit_amount ) 
                                ) / cr_retail_limit.allowed_limit
                            ) * 100 
                        ),2), '%') AS utilization_rate`;
            var data = await knex("cr_credit_disbursements")
                .select(knex.raw(select))
                .leftJoin("cr_retail_limit", "cr_credit_disbursements.id_outlet", "cr_retail_limit.id_outlet")
                .leftJoin("retailers", "retailers.id", "cr_retail_limit.id_outlet")
                .leftJoin("routes", "routes.id", "retailers.rtid")
                .leftJoin("section_days", "routes.section", "section_days.section")
                .where(function () {
                    if (req.dpids) {
                        this.whereIn("cr_retail_limit.id_point", req.dpids);
                    }
                    if (req.selectedOutlets) {
                        this.whereIn("cr_retail_limit.id_outlet", req.selectedOutlets);
                    }
                    if (req.tillDate) {
                        this.where("cr_credit_disbursements.sys_date", '<=', req.tillDate);
                    }
                })
                .where("cr_retail_limit.activation_status", "Active")
                .groupBy("cr_retail_limit.outlet_code")
                .paginate({
                    perPage: req.countPerPage,
                    currentPage: req.page,
                    isLengthAware: true
                });

            if (data == 0 || !data.data.length) {
                resolve(sendApiResult(false, "Data not found", []));
            }
            else {
                resolve(sendApiResult(true, "Data successfully fetched.", data));
            }

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

ReportModel.getBadDebtsOutlets = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex.select(knex.raw(`distributorspoint.region AS region_id,
                    region.slug AS region,
                    distributorspoint.area AS area_id,
                    area.slug AS area,
                    distributorspoint.dsid AS house_id,
                    company.name AS house,
                    distributorspoint.territory AS territory_id,
                    territory.slug AS territory,
                    distributorspoint.id AS point_id,
                    distributorspoint.name AS point,
                    retail.id as id_cr_retail_limit,
                    retail.id_cr_limit_info,
                    retail.acc_no,
                    retail.id_outlet,
                    retail.outlet_code,
                    retail.outlet_name,
                    retail.owner_name,
                    retail.phone,
                    retail.address,
                    retail.rejection_reason,
                    DATE_FORMAT(retail.updated_at, "%d %b %Y %h:%i %p") updated_at,
                    DATE_FORMAT(cr_credit_disbursements.sys_date, "%d %b %Y") as due_taken_date,
                    retail.total_due AS old_due_amount,
                    retail.minimum_due AS due_amount
                `))
                .from("distributorspoint")
                .innerJoin("company", "distributorspoint.dsid", "company.id")
                .innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
                .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
                .innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
                .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
                .innerJoin("cr_credit_disbursements", "cr_credit_disbursements.id_outlet", "retail.id_outlet")
                .innerJoin("cr_disbursement_wise_interest", "cr_credit_disbursements.id", "cr_disbursement_wise_interest.id_cr_credit_disbursement")
                //.whereNotIn("distributorspoint.id", [334, 338, 339, 339, 340]) //344 needs to be added
                .andWhere("distributorspoint.stts", 1)
                .whereIn("distributorspoint.id", req['dpids'])
                .where("retail.kyc_status", "Approved")
                .where("cr_disbursement_wise_interest.is_penalty_interest", 1)
                .whereNot("cr_credit_disbursements.due_amount", 0)
                .orderBy("retail.id", "asc")
                .groupBy("retail.outlet_code")
                .paginate({
                    perPage: req['per_page'],
                    currentPage: req['current_page'],
                    isLengthAware: true
                });
            // added by moin start    
            const dataForRouteSectionDays = await knex("retailers")
                .select(knex.raw(`routes.number as route_number,retailers.retailer_code,CONCAT( routes.number, section_days.slug ) section,(CASE WHEN LENGTH( clusters.name )< 3 AND clusters.name <> CONCAT( routes.number, section_days.slug ) THEN 'Not Defined' ELSE clusters.name END) AS cluster`))
                .innerJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "retailers.id")
                .innerJoin("routes", "retailers.rtid", "routes.id")
                .innerJoin("section_days", "section_days.section", "routes.section")
                .leftJoin("clusters", "retailers.cname", "clusters.id")
                .where("retailers.stts", 1)
                .whereIn("cr_retail_limit.id_point", req['dpids']);


            let arraydataForRouteSectionDays = {};
            dataForRouteSectionDays.map(row => {
                retailerCode = row.retailer_code;
                delete row.retailer_code;
                return arraydataForRouteSectionDays[retailerCode] = row;
            });


            data.data.map(row => {
                if (arraydataForRouteSectionDays.hasOwnProperty(row.outlet_code)) {
                    row.section = arraydataForRouteSectionDays[row.outlet_code].section;
                    row.cluster = arraydataForRouteSectionDays[row.outlet_code].cluster;

                }
                else {
                    row.section = '';
                    row.cluster = '';

                }
            });
            // added by moin end
            resolve(sendApiResult(true, "Outlet Without Doc Uploaded Fetched", data));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

ReportModel.paymentMadeByDhToFi = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            var data = await knex({ cp: "cr_credit_payments" })
                .select(
                    knex.raw('DATE_FORMAT(cp.sys_date, "%d %b %Y") sys_date'),
                    knex.raw("sum( cp.paid_amount ) AS paid_amount"),
                    knex.raw("sum( cp.paid_interest_amount ) AS interest_amount"),
                    knex.raw("sum( cp.paid_principle ) AS principle_amount"),
                    knex.raw("sum( cp.carry_amount ) AS carry_amount"),
                    //knex.raw("sum( cd.credit_amount ) AS disbursed_amount")
                    knex.raw(`(
                                    SELECT sum( cd.credit_amount )
                                    FROM cr_credit_disbursements cd
                                    WHERE cd.sys_date = cp.sys_date
                                    AND cd.sys_date BETWEEN '${req.fromDate}' AND '${req.toDate}'
                                ) as disbursed_amount`)
                )
                .innerJoin({ cph: "cr_credit_payment_histories" }, function () {
                    this.on("cph.id_outlet", "=", "cp.id_outlet")
                        .on("cp.sys_date", "=", "cph.sys_date")
                })
                .leftJoin({ crl: "cr_retail_limit" }, "crl.id_outlet", "cp.id_outlet")
                .where(function () {
                    if (req.dpids) {
                        this.whereIn("crl.id_point", req.dpids);
                    }
                    if (req.fromDate) {
                        this.where("cp.sys_date", '>=', req.fromDate);
                    }
                    if (req.toDate) {
                        this.where("cp.sys_date", '<=', req.toDate);
                    }
                })
                .where("crl.activation_status", "Active")
                .groupBy("cp.sys_date")
                .orderBy("cp.sys_date", "desc")
                .paginate({
                    perPage: req.per_page,
                    currentPage: req.current_page,
                    isLengthAware: true
                });

            if (data == 0) {
                resolve(sendApiResult(false, "Data not found", []));
            }
            else {
                resolve(sendApiResult(true, "Data successfully fetched.", data));
            }

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

ReportModel.totalCreditMemoVsPayments = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            var filterText = req.filterText;
            // LEFT JOIN cr_retail_limit AS crl ON crl.outlet_code = cp.outlet_code
            var data = await knex({ cd: "cr_credit_disbursements" })
                .select(
                    "dh.name AS dh_name",
                    "crl.outlet_code",
                    "crl.outlet_name",
                    knex.raw("count( cd.id_outlet ) AS total_credit_memo_transaction"),
                    // knex.raw(`(
                    //                     SELECT
                    //                         count( cp.id_outlet )
                    //                     FROM
                    //                         cr_credit_payments cp

                    // 					INNER JOIN cr_retail_limit AS crl ON crl.id_outlet = cp.id_outlet
                    //                     WHERE
                    // 						crl.id_point IN (${req.dpids.join()}) 
                    // 						AND crl.id_point NOT IN (334, 344)										  
                    //                         AND cp.sys_date BETWEEN '${req.fromDate}'
                    //                         AND '${req.toDate}'
                    // 						AND cd.outlet_code = cp.outlet_code
                    //                         AND cp.paid_amount > 0
                    //                     ) AS total_credit_payment`
                    // )
                    knex.raw(`(
                        SELECT
                            count( cp.id_outlet )
                        FROM
                            cr_credit_payments cp
                        
                        INNER JOIN cr_retail_limit AS crl ON crl.id_outlet = cp.id_outlet
                        WHERE
                            crl.id_point IN (${req.dpids.join()}) 										  
                            AND cp.sys_date BETWEEN '${req.fromDate}'
                            AND '${req.toDate}'
                            AND cd.outlet_code = cp.outlet_code
                            AND cp.paid_amount > 0
                        ) AS total_credit_payment`
                    )
                )
                // .leftJoin({ crl: "cr_retail_limit" }, "crl.outlet_code", "cd.outlet_code")
                .innerJoin({ crl: "cr_retail_limit" }, "crl.id_outlet", "cd.id_outlet")
                // .leftJoin({ dh: "company" }, "dh.id", "crl.id_dh")
                .innerJoin({ dh: "company" }, "dh.id", "crl.id_dh")
                .where(function () {
                    if (req.dpids) {
                        this.whereIn("crl.id_point", req.dpids);
                        this.whereNotIn("crl.id_point", [334, 344]);
                    }
                    if (req.fromDate) {
                        this.where("cd.sys_date", '>=', req.fromDate);
                    }
                    if (req.toDate) {
                        this.where("cd.sys_date", '<=', req.toDate);
                    }
                    if (filterText) {
                        var search_param = filterText.toLowerCase().replace(/\s/g, '');
                        this.whereRaw(`LOWER(REPLACE(crl.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                    }
                })
                .where("crl.activation_status", "Active")
                // .groupBy("crl.outlet_code")
                .groupBy("crl.id_outlet")
                .paginate({
                    perPage: req.per_page,
                    currentPage: req.current_page,
                    isLengthAware: true
                });

            if (data == 0) {
                resolve(sendApiResult(false, "Data not found", []));
            }
            else {
                resolve(sendApiResult(true, "Data successfully fetched.", data));
            }

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

ReportModel.outletWiseCreditInfo = async (req) => {
    const dpids = await getFiBaseDpids(req.fi_id);
    return new Promise(async (resolve, reject) => {
        try {
            var filterText = req.filterText;
            var data = await knex("cr_retail_limit")
                .select(
                    knex.raw("dh.name AS dh_name"),
                    "cr_retail_limit.outlet_code",
                    "cr_retail_limit.outlet_name",
                    knex.raw("IFNULL(( SELECT sum( cr_credit_disbursements.credit_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet ),0) AS loan_taken"),
                    knex.raw("IFNULL(( SELECT sum( cr_credit_disbursements.due_amount + cr_credit_disbursements.total_interest_amount - cr_credit_disbursements.total_paid_interest_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet ),0) AS due_amount"),
                    knex.raw("IFNULL((SELECT sum( cr_credit_payments.paid_amount ) FROM cr_credit_payments WHERE  cr_retail_limit.id_outlet = cr_credit_payments.id_outlet),0) AS paid_amount"),
                    knex.raw("IFNULL(( SELECT sum( cr_credit_disbursements.paid_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet ),0) AS paid_principle"),
                    knex.raw("IFNULL(( SELECT sum( cr_credit_disbursements.total_paid_interest_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet ),0) AS paid_interest_amount"),
                    knex.raw(`IFNULL(((SELECT  sum( cr_credit_payments.paid_amount ) FROM cr_credit_payments WHERE cr_retail_limit.id_outlet = cr_credit_payments.id_outlet) - ( SELECT sum( cr_credit_disbursements.paid_amount + cr_credit_disbursements.total_paid_interest_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet)),0) AS carry_amount`)
                )
                //.leftJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "cr_credit_payments.id_outlet")
                .innerJoin({ dh: "company" }, "dh.id", "cr_retail_limit.id_dh")
                .where(function () {
                    // this.whereNot("cr_retail_limit.id_dh", 57);
                    if (dpids) {
                        this.whereIn("cr_retail_limit.id_point", dpids);
                    }
                    if (filterText) {
                        var search_param = filterText.toLowerCase().replace(/\s/g, '');
                        this.whereRaw(`LOWER(REPLACE(crl.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                    }
                    this.where(knex.raw("( SELECT sum( cr_credit_disbursements.credit_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet )"), '>', 0);
                })
                .groupBy("cr_retail_limit.id_outlet")
                .orderBy("outlet_code", "asc")
                .paginate({
                    perPage: req.per_page,
                    currentPage: req.current_page,
                    isLengthAware: true
                });

            if (data == 0) {
                resolve(sendApiResult(false, "Data not found", []));
            }
            else {
                resolve(sendApiResult(true, "Data successfully fetched.", data));
            }

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}


ReportModel.checkIfAnyBlcokDue = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            var comparingDay = moment().add(-14, 'days').format('YYYY-MM-DD');

            var data = await knex("cr_credit_disbursements")
                .select("cr_credit_disbursements.due_amount")
                .where("cr_credit_disbursements.due_amount", '>', 0)
                .where("cr_credit_disbursements.sys_date", '<=', comparingDay)
                .where("cr_credit_disbursements.id_outlet", req.params.id_outlet);
            var due = 0;
            console.log(data);
            if (data == 0) {
                var message = 'No debt';
                var data = {
                    message: message,
                    due: 0,
                };
            } else {
                var message = 'You have to pay your due amount to proceed';
                var data = {
                    message: message,
                    due: data[0].due_amount,
                };
            };

            resolve(sendApiResult(true, "Due info", data));
        } catch (error) {
            console.log(error);
            reject(sendApiResult(false, error.message));
        }
    });
}

ReportModel.repaymentDayReport = async (req) => {
    const dpids = await getFiBaseDpids(req.fi_id);
    return new Promise(async (resolve, reject) => {
        try {
            var filterText = req.filterText;
            var data = await knex("cr_retail_limit")
                .select(
                    knex.raw("dh.name AS house"),
                    knex.raw("distributorspoint.name AS point"),
                    "cr_retail_limit.outlet_code",
                    "cr_retail_limit.outlet_name",
                    "cr_retail_limit.owner_name",
                    "cr_retail_limit.phone",
                    "cr_retail_limit.address",
                    "cr_credit_disbursements.credit_amount",
                    knex.raw(`IFNULL(
                                    (
                                    SELECT
                                        DATEDIFF(
                                        CASE
                                                
                                                WHEN cr_credit_disbursements.due_amount = 0 THEN
                                                cr_credit_payments.sys_date ELSE SYSDATE() 
                                            END,
                                            cr_credit_disbursements.sys_date 
                                        ) 
                                    FROM
                                        cr_credit_payments 
                                    WHERE
                                        cr_credit_payments.id_outlet = cr_credit_disbursements.id_outlet 
                                        AND cr_credit_payments.sys_date > cr_credit_disbursements.sys_date 
                                    ORDER BY
                                        cr_credit_payments.id ASC 
                                        LIMIT 1 
                                    ),
                                    DATEDIFF(SYSDATE(), cr_credit_disbursements.sys_date) 
                                ) AS no_of_days_taken_to_repay`),
                    "cr_credit_disbursements.due_amount",
                    knex.raw(`DATE_FORMAT(cr_credit_disbursements.sys_date, "%d-%b-%Y") as credit_disbursements_date`)
                )
                .innerJoin({ dh: "company" }, "dh.id", "cr_retail_limit.id_dh")
                .innerJoin("distributorspoint", "cr_retail_limit.id_point", "distributorspoint.id")
                .innerJoin("cr_credit_disbursements", "cr_retail_limit.id_outlet", "cr_credit_disbursements.id_outlet")
                .where(function () {
                    // this.whereNot("cr_retail_limit.id_dh", 57);
                    if (dpids) {
                        this.whereIn("cr_retail_limit.id_point", dpids);
                    }
                    if (filterText) {
                        var search_param = filterText.toLowerCase().replace(/\s/g, '');
                        this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                    }
                })
                .orderBy("cr_retail_limit.id_outlet", "asc")
                .paginate({
                    perPage: req.per_page,
                    currentPage: req.current_page,
                    isLengthAware: true
                });

            if (data == 0) {
                resolve(sendApiResult(false, "Data not found", []));
            }
            else {
                resolve(sendApiResult(true, "Data successfully fetched.", data));
            }

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

// ReportModel.outstandingReportDownload = function (req) {
//     return new Promise(async (resolve, reject) => {
//         var fromDate = req.dateFrom;
//         var toDate = req.dateTo;
//         const result = await knex("cr_disbursement_wise_interest_daily_sys")
//             .select(
//                 "cr_retail_limit.outlet_code AS outlet_code",
//                 // "cr_retail_limit.outlet_name AS outlet_name",
//                 // "cr_retail_limit.phone AS phone",
//                 "cr_interest_settings.interest_percentage AS interest_rate",
//                 "cr_interest_settings.service_charge_percentage AS service_charge",
//                 "cr_retail_limit.loan_account_number AS loan_account_number",
//                 "cr_retail_limit.client_id AS client_id",
//                 knex.raw(`DATE_FORMAT(cr_disbursement_wise_interest_daily_sys.sys_date, "%d %b %Y") AS sys_date`),
//                 // knex.raw("(cr_interest_settings.interest_percentage + cr_interest_settings.service_charge_percentage + cr_interest_settings.penalty_percentage) AS interest_rate"),
//                 knex.raw("SUM(cr_disbursement_wise_interest_daily_sys.total_outstanding) AS total_outstanding"),
//                 knex.raw("SUM(cr_disbursement_wise_interest_daily_sys.principle_outstanding) AS principle_outstanding"),
//                 knex.raw("SUM(cr_disbursement_wise_interest_daily_sys.interest_outstanding) AS interest_outstanding"),
//                 knex.raw("SUM(cr_disbursement_wise_interest_daily_sys.daywize_interest) AS daywize_interest"),
//                 // knex.raw("SUM(cr_disbursement_wise_interest_daily_sys.daywize_total) AS daywize_total"),
//                 // "cr_disbursement_wise_interest_daily_sys.interest_rate AS daily_interest_rate",
//             )
//             .innerJoin("cr_retail_limit", "cr_retail_limit.outlet_code", "cr_disbursement_wise_interest_daily_sys.outlet_code")
//             .innerJoin("cr_interest_settings", "cr_retail_limit.outlet_code", "cr_interest_settings.outlet_code")
//             .where(function () {
//                 if (fromDate) {
//                     this.where("cr_disbursement_wise_interest_daily_sys.sys_date", '>=', fromDate);
//                 }
//                 if (toDate) {
//                     this.where("cr_disbursement_wise_interest_daily_sys.sys_date", '<=', toDate);
//                 }
//             })
//             .whereIn("cr_retail_limit.id_point", req.dpids)
//             // .whereNotIn("cr_retail_limit.id_point", [334, 344])
//             .groupBy("cr_disbursement_wise_interest_daily_sys.outlet_code")
//             .orderBy("cr_retail_limit.outlet_code", "asc")

//         if (result.length == 0) {
//             reject(sendApiResult(false, "No Outlet Data Found."));
//         } else {
//             // const today = moment(new Date()).format('YYYY-MM-DD');
//             // var workbook = new excel.Workbook();
//             // var worksheet = workbook.addWorksheet("Outstanding Report");
//             // var headerStyle = workbook.createStyle({
//             //     fill: {
//             //         type: "pattern",
//             //         patternType: "solid",
//             //         bgColor: "#E1F0FF",
//             //         fgColor: "#E1F0FF"
//             //     },
//             //     font: {
//             //         color: "#000000",
//             //         size: "10",
//             //         bold: true,
//             //         vertical: 'center',
//             //         horizontal: 'center'
//             //     }
//             // });

//             // var headers = [
//             //     "Sr.",
//             //     "Retailer Code",
//             //     // "Outlet Name",
//             //     // "Phone",
//             //     "Interest Rate",
//             // 	"Service Charge",
//             //     "Loan Account Number",
//             //     "Client ID",
//             //     "Date",
//             //     "Total Outstanding",
//             //     "Principle Outstanding",
//             //     "Interest Outstanding",
//             //     "Daywize Accrued Interest"
//             //     // "Daywize Total Outstanding",
//             // ];

//             // var col = 1;
//             // var row = 1;
//             // var col_add = 0;

//             // headers.forEach((e) => {
//             //     worksheet
//             //         .cell(row, col + col_add)
//             //         .string(e)
//             //         .style(headerStyle);
//             //     col_add++;
//             // });

//             // row = 2;
//             // for (let i = 0; i < result.length; i++) {
//             //     var col_add = 0;
//             //     let e = result[i];
//             //     worksheet.cell(row, col + col_add).number((i + 1));
//             //     col_add++;
//             //     worksheet.cell(row, col + col_add).string(e.outlet_code ? e.outlet_code : "");
//             //     col_add++;
//             //     // worksheet.cell(row, col + col_add).string(e.outlet_name ? e.outlet_name : "");
//             //     // col_add++;
//             //     // worksheet.cell(row, col + col_add).string(e.phone ? e.phone : "");
//             //     // col_add++;
//             //     worksheet.cell(row, col + col_add).string(e.interest_rate ? (e.interest_rate + '%') : "");
//             //     col_add++;
//             // 	worksheet.cell(row, col + col_add).string(e.service_charge ? (e.service_charge + '%') : "");
//             //     col_add++;
//             //     worksheet.cell(row, col + col_add).string(e.loan_account_number ? e.loan_account_number : "-");
//             //     col_add++;
//             //     worksheet.cell(row, col + col_add).string(e.client_id ? ""+e.client_id : "-");
//             //     col_add++;
//             //     worksheet.cell(row, col + col_add).string(e.sys_date ? e.sys_date : "");
//             //     col_add++;
//             //     worksheet.cell(row, col + col_add).number(e.total_outstanding ? e.total_outstanding : "");
//             //     col_add++;
//             //     worksheet.cell(row, col + col_add).number(e.principle_outstanding ? e.principle_outstanding : "");
//             //     col_add++;
//             //     worksheet.cell(row, col + col_add).number(e.interest_outstanding);
//             //     col_add++;
//             //     worksheet.cell(row, col + col_add).number(e.daywize_interest);
//             //     col_add++;
//             //     // worksheet.cell(row, col + col_add).number(e.daywize_total ? e.daywize_total : ""); 
//             //     // col_add++;
//             //     row++;
//             // }

//             // const file_path = 'public/eKyc_documents/';
//             // if (!fs.existsSync(file_path)) {
//             //     fs.mkdirSync(file_path, { recursive: true });
//             // }
//             // workbook.write(file_path + "Outstanding Report (" + fromDate + " to " + toDate + ").xlsx");
//             // const fileName = "download/eKyc_documents/Outstanding Report (" + fromDate + " to " + toDate + ").xlsx";
//             // await timeout(1500);
//             // resolve(sendApiResult(true, "Outstanding Report Download", fileName));

//             let header = [
//                 { header: 'SN', key: 'sn', width: 10 },
//                 { header: 'Retailer Code ', key: 'outlet_code', width: 15 },
//                 { header: 'Interest Rate (%)', key: 'interest_rate', width: 13 },
//                 { header: 'Service Charge (%)', key: 'service_charge', width: 13 },
//                 { header: 'Loan Account Number', key: 'loan_account_number', width: 22 },
//                 { header: 'Client ID', key: 'client_id', width: 10 },
//                 { header: 'Date', key: 'sys_date', width: 11 },
//                 { header: 'Total Outstanding', key: 'total_outstanding', width: 18 },
//                 { header: 'Principle Outstanding', key: 'principle_outstanding', width: 21 },
//                 { header: 'Interest Outstanding', key: 'interest_outstanding', width: 20 },
//                 { header: 'Daywize Accrued Interest', key: 'daywize_interest', width: 24 },
//             ]


//             const fileName = "eKyc_documents/Outstanding Report (" + fromDate + " to " + toDate + ").xlsx";


//             let options = {
//                 'addSerialNumber': true,
//             };
//             createExcle(header, process.env.PUBLIC_URL + "" + fileName, result, options);

//             await timeout(1500);
// 			const url = generateBlobDownloadURL(fileName);
// 			console.log(url);
//             resolve(sendApiResult(true, "File Generated", url));
//         }
//     })
// }

ReportModel.outstandingReportDownload = function (req) {
    return new Promise(async (resolve, reject) => {
        const currentDate = req.date;
    //    const currentDate = moment().format("YYYY-MM-DD");
    //    console.log(currentDate);
       const dpids = req.dpids;

        let credit = await knex("cr_credit_disbursements")
            .select(
                "cr_retail_limit.outlet_code",
                "cr_retail_limit.outlet_name",
				"cr_retail_limit.phone",
                "cr_retail_limit.client_id AS client_id",
                "cr_retail_limit.loan_account_number AS loan_account_number",
                "cr_interest_settings.interest_percentage AS interest_rate",
                "cr_interest_settings.service_charge_percentage AS service_charge",
                knex.raw(`DATE_FORMAT(cr_credit_disbursements.sys_date, "%d-%b-%Y") as sys_date`),
                knex.raw("SUM(cr_credit_disbursements.credit_amount ) AS total_credit"),
                knex.raw("SUM(cr_credit_disbursements.total_interest_amount ) AS total_interest")
            )
            .innerJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "cr_credit_disbursements.id_outlet")
            .innerJoin("cr_interest_settings", "cr_retail_limit.outlet_code", "cr_interest_settings.outlet_code")
            .where("cr_credit_disbursements.sys_date","<=",currentDate)
            .whereIn("cr_retail_limit.id_point", dpids)
            .groupBy("cr_retail_limit.outlet_code")
            .orderBy("cr_retail_limit.outlet_code", "asc")
          
    
        let payments = await knex("cr_credit_payments")
            .select(
                "cr_retail_limit.outlet_code",
                knex.raw("SUM(cr_credit_payments.paid_amount ) AS paid_amount"),
                knex.raw("SUM(cr_credit_payments.paid_principle ) AS paid_pric"),
                knex.raw("SUM(cr_credit_payments.paid_interest_amount ) AS paid_interest_amount")
            )
            .innerJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "cr_credit_payments.id_outlet")
            .where("cr_credit_payments.sys_date","<=",currentDate)
            .whereIn("cr_retail_limit.id_point", dpids)
            .groupBy("cr_retail_limit.outlet_code")
            .orderBy("cr_retail_limit.outlet_code", "asc");
                
           
            const newPayments = keyBy(payments,'outlet_code');
            arr = [];
            credit = credit.map(creditElement =>{

                let outstadningObject = {};
                outstadningObject.outlet_code = creditElement.outlet_code;
                outstadningObject.interest_rate = creditElement.interest_rate;
                outstadningObject.service_charge = creditElement.service_charge;
                outstadningObject.loan_account_number = creditElement.loan_account_number;
                outstadningObject.client_id = creditElement.client_id;
                outstadningObject.sys_date = creditElement.sys_date;

                const paymentData = newPayments[creditElement.outlet_code];
                
                if(paymentData){
                    outstadningObject.total_outstanding = creditElement.total_credit + creditElement.total_interest - paymentData.paid_amount; 
                    outstadningObject.principle_outstanding = creditElement.total_credit - paymentData.paid_pric;
                    const interest_outstanding = creditElement.total_interest - paymentData.paid_interest_amount;
                    outstadningObject.interest_outstanding = interest_outstanding > 0 ? interest_outstanding : 0;
                }
                else{
                    outstadningObject.total_outstanding = creditElement.total_credit +creditElement.total_interest - 0;
                    outstadningObject.principle_outstanding = creditElement.total_credit - 0;
                    const interest_outstanding = creditElement.total_interest - 0;
                    outstadningObject.interest_outstanding = interest_outstanding > 0 ? interest_outstanding : 0;
                }
                outstadningObject.daywize_interest = creditElement.total_interest;
                    
                return outstadningObject
            })
        
        if (credit.length == 0) {
            reject(sendApiResult(false, "No Outlet Data Found."));
        } else {
          

            let header = [
                { header: 'SN', key: 'sn', width: 10},
                { header: 'Retailer Code ', key: 'outlet_code', width: 15},
                { header: 'Interest Rate (%)', key: 'interest_rate', width: 11},
                { header: 'Service Charge (%)', key: 'service_charge', width: 11},
                { header: 'Loan Account Number', key: 'loan_account_number', width: 22},
                { header: 'Client ID', key: 'client_id', width: 10},
                { header: 'Date', key: 'sys_date', width: 11},
                { header: 'Total Outstanding', key: 'total_outstanding', width: 18},
                { header: 'Principle Outstanding', key: 'principle_outstanding', width: 21},
                { header: 'Interest Outstanding', key: 'interest_outstanding', width: 20},
                { header: 'Daywize Accrued Interest', key: 'daywize_interest', width: 24},
            ]

            
          
            const fileName = `eKyc_documents/Outstanding Report (2021-03-22 to ${currentDate}).xlsx`;
       
            let options = {
                'addSerialNumber' : true,  
            };
         
            createExcle(header, process.env.PUBLIC_URL + "" + fileName, credit, options);
            
            await timeout(1500);
			const url = generateBlobDownloadURL(fileName);
            // console.log(url);
            resolve(sendApiResult(true, "File Generated", url));
        }
    })
}


ReportModel.registrationLiveUpdate = function () {
    return new Promise(async (resolve, reject) => {
        const today = moment(new Date()).format('YYYY-MM-DD');

        const liveUpdateResourses = await knex("cr_live_update_data")
            .select(
                'cr_live_update_data.*'
            )
            .where('cr_live_update_data.date', today)
            .first();

        const activePhase = await knex("cr_retail_phase")
            .select(
                'cr_retail_phase.id'
            )
            .where('cr_retail_phase.leaderboard_status', 1)
            .where('cr_retail_phase.status', 1)
            .first();

        const tillDateRegistration = await knex('cr_retail_limit')
            .select(
                knex.raw(`count(cr_retail_limit.id) as total_registration`)
            )
            .whereNot('cr_retail_limit.kyc_status', 'Initial')
            .where('cr_retail_limit.phase_id', activePhase.id);

        const tillDateRegistrationPercentage = ((parseFloat(tillDateRegistration[0].total_registration / liveUpdateResourses.scope_partner_number)) * 100.0).toFixed(1);

        const result = {
            "till_date_registration": tillDateRegistration[0].total_registration,
            "map": liveUpdateResourses.map_file_name,
            "till_date_registration_percentage": tillDateRegistrationPercentage,
        }

        resolve(sendApiResult(true, "National lunch update", result));
    })
}

const customerData = async function (req) {

    const query = await knex("cr_retail_limit")
        .select(
            'cr_retail_limit.id_outlet',
            'cr_retail_limit.outlet_code',
            'cr_retail_limit.loan_account_number',
            'cr_retail_limit.client_id',
            'cr_retail_additional_info.branch',
            'cr_retail_additional_info.title',
            'cr_retail_additional_info.name',
            'cr_retail_additional_info.father_title',
            'cr_retail_additional_info.father_name',
            'cr_retail_additional_info.mother_title',
            'cr_retail_additional_info.mother_name',
            'cr_retail_additional_info.spouse_title',
            'cr_retail_additional_info.spouse_name',
            'cr_retail_additional_info.gender',
            knex.raw(`DATE_FORMAT(cr_retail_additional_info.dob, " %Y-%m-%d") AS dob`),
            'cr_retail_additional_info.birth_district',
            'cr_retail_additional_info.birth_country',
            'cr_retail_additional_info.17_digit_nid AS _17_digit_nid',
            'cr_retail_additional_info.10_digit_nid AS _10_digit_nid',
            'cr_retail_additional_info.tin_number',
            'cr_retail_additional_info.parmanent_address',
            'cr_retail_additional_info.parmanent_address_post_code',
            'cr_retail_additional_info.parmanent_address_district',
            'cr_retail_additional_info.country_of_permanent_address',
            'cr_retail_additional_info.business_address',
            'cr_retail_additional_info.business_address_code',
            'cr_retail_additional_info.business_address_district',
            'cr_retail_additional_info.country_of_Business',
            'cr_retail_additional_info.phone',
            'company.name AS distributor_name',
            'distributorspoint.name AS point_name',
            'cr_retail_limit.credit_amount AS limit',
            knex.raw(`DATE_FORMAT(cr_retail_limit_info.created_at, " %Y-%m-%d") AS open_date`),
            knex.raw(`DATE_FORMAT(cr_retail_limit.end_date, " %Y-%m-%d") AS end_date`),
            'cr_interest_settings.interest_percentage AS principal_in_rate',
            'cr_interest_settings.service_charge_percentage AS service_charge',
            //knex.raw(`IF(sum(cr_credit_disbursements.credit_amount) IS NULL,0.00, sum(cr_credit_disbursements.credit_amount)) AS credit_amount`),
            //knex.raw(`IF(sum(cr_credit_disbursements.total_interest_amount) IS NULL,0.00, sum(cr_credit_disbursements.total_interest_amount)) AS total_interest_amount`),
            //knex.raw(`IF(sum(cr_credit_payments.paid_amount) IS NULL,0.00, sum(cr_credit_payments.paid_amount)) AS paid_amount`),
            //knex.raw(`IF(sum(cr_credit_payments.paid_principle) IS NULL,0.00, sum(cr_credit_payments.paid_principle)) AS paid_principle`),
            //knex.raw(`IF(sum(cr_credit_payments.paid_interest_amount) IS NULL,0.00, sum(cr_credit_payments.paid_interest_amount)) AS paid_interest_amount`),
            //knex.raw(`IF(sum(cr_credit_payments.carry_amount) IS NULL,0.00, sum(cr_credit_payments.carry_amount)) AS carry_amount`)
        )
        .leftJoin({ cr_retail_additional_info: "cr_retail_additional_info" }, "cr_retail_additional_info.retailer_code", "cr_retail_limit.outlet_code")
        .innerJoin({ distributorspoint: "distributorspoint" }, "distributorspoint.id", "cr_retail_limit.id_point")
        .innerJoin({ company: "company" }, "distributorspoint.dsid", "company.id")
        .innerJoin({ cr_retail_limit_info: "cr_retail_limit_info" }, "cr_retail_limit.id_cr_limit_info", "cr_retail_limit_info.id")
        .innerJoin({ cr_interest_settings: "cr_interest_settings" }, "cr_interest_settings.outlet_code", "cr_retail_limit.outlet_code")
        //.leftJoin({ cr_credit_disbursements : "cr_credit_disbursements" }, "cr_credit_disbursements.id_outlet", "cr_retail_limit.id_outlet")						
        //.leftJoin({ cr_credit_payments : "cr_credit_payments" }, "cr_credit_payments.id_outlet", "cr_retail_limit.id_outlet")						
        .where(function () {
            //this.whereNotIn("cr_retail_limit.id_dh", [57]);
            this.whereIn("cr_retail_limit.id_point", req.dpids);
            // this.whereNotIn("cr_retail_limit.id_point", [334,344]);
            this.where("cr_retail_limit.activation_status", 'Active');
            this.where("cr_retail_limit.kyc_status", "Approved")
            this.where("cr_retail_limit.limit_status", 'FI Confirmed');
            //this.where("cr_interest_settings.activation_status", 'Active');
            //this.whereNotIn("cr_interest_settings.id_point", [334,344]);
        })
        .orderBy("cr_retail_limit.id", "ASC")
        .groupBy("cr_retail_limit.outlet_code");
    //.toSQL().toNative();
    //console.log(query);
    return query;
}

const monthlyData = async function (req, today, month) {
    var d = new Date(today);
    d.setMonth(d.getMonth() - month);
    var date = d.toLocaleDateString();
    var dt = date.split("/");
    var expected_date = dt[2] + '-' + ('0' + dt[0]).slice(-2) + '-' + ('0' + dt[1]).slice(-2);

    //console.log(expected_date);

    const query = await knex("cr_retail_limit")
        .select(
            'cr_retail_limit.outlet_code',
            knex.raw(`IF(sum(cr_credit_payments.paid_amount) IS NULL,0.00, sum(cr_credit_payments.paid_amount)) AS paid_amount`),
            knex.raw(`IF(sum(cr_credit_payments.paid_interest_amount) IS NULL,0.00, sum(cr_credit_payments.paid_interest_amount)) AS paid_interest_amount`)
        )
        .leftJoin({ cr_credit_payments: "cr_credit_payments" }, "cr_credit_payments.id_outlet", "cr_retail_limit.id_outlet")
        .where(function () {
            this.whereBetween("cr_credit_payments.sys_date", [expected_date, today]);
            this.whereNotIn("cr_retail_limit.id_dh", [57]);
            this.whereIn("cr_retail_limit.id_point", req.dpids);
            this.whereNotIn("cr_retail_limit.id_point", [334, 344]);
            this.where("cr_retail_limit.activation_status", 'Active');
            this.where("cr_retail_limit.limit_status", 'FI Confirmed');
        })
        .orderBy("cr_retail_limit.id", "ASC")
        .groupBy("cr_retail_limit.id_outlet");

    var monthly_data = {};
    for (const [key, value] of Object.entries(query)) {
        monthly_data[value.outlet_code] = {};
        monthly_data[value.outlet_code][month] = {};
        monthly_data[value.outlet_code][month]['paid_amount'] = value.paid_amount;
        monthly_data[value.outlet_code][month]['paid_interest_amount'] = value.paid_interest_amount;
    }
    return monthly_data;
}

const outStandingData = async function (till_date) {
    const out_standings = await knex("cr_total_outstanding_daily_wise")
        .select(
            'cr_total_outstanding_daily_wise.outlet_code',
            'cr_total_outstanding_daily_wise.total_credit',
            'cr_total_outstanding_daily_wise.total_interest',
            'cr_total_outstanding_daily_wise.total',
            'cr_total_outstanding_daily_wise.paid_amount',
            'cr_total_outstanding_daily_wise.paid_principle',
            'cr_total_outstanding_daily_wise.paid_interest_amount',
            'cr_total_outstanding_daily_wise.total_outstanding',
            'cr_total_outstanding_daily_wise.principle_outstanding',
            'cr_total_outstanding_daily_wise.interest_outstanding',
            'cr_total_outstanding_daily_wise.interest_rate',
            'cr_total_outstanding_daily_wise.interest'

        )
        .where("cr_total_outstanding_daily_wise.sys_date", "<=", till_date);
    data = {};
    for (const [key, value] of Object.entries(out_standings)) {
        data[value.outlet_code] = {};
        data[value.outlet_code]['total_credit'] = value.total_credit;
        data[value.outlet_code]['total_interest'] = value.total_interest;
        data[value.outlet_code]['total'] = value.total;
        data[value.outlet_code]['paid_amount'] = value.paid_amount;
        data[value.outlet_code]['paid_principle'] = value.paid_principle;
        data[value.outlet_code]['paid_interest_amount'] = value.paid_interest_amount;
        data[value.outlet_code]['total_outstanding'] = value.total_outstanding;
        data[value.outlet_code]['principle_outstanding'] = value.principle_outstanding;
        data[value.outlet_code]['principle_outstanding'] = value.principle_outstanding;
        data[value.outlet_code]['interest_outstanding'] = value.interest_outstanding;
        data[value.outlet_code]['interest_rate'] = value.interest_rate;
        data[value.outlet_code]['interest'] = value.interest;
    }
    return data;
}

ReportModel.downloadCustomerReport = function (req) {
    return new Promise(async (resolve, reject) => {
        const result = await customerData(req);
        const till_date = req.till_date;
        const lastOneMonthData = await monthlyData(req, till_date, 1);
        const lastThreeMonthData = await monthlyData(req, till_date, 3);
        //resolve(sendApiResult(true, "download Customer Report"));

        if (result.length == 0) {
            reject(sendApiResult(false, "No Customer Data Found."));
        } else {

            var workbook = new excel.Workbook();
            var worksheet = workbook.addWorksheet("Customer Report Download (" + till_date + ")");
            var headerStyle = workbook.createStyle({
                fill: {
                    type: "pattern",
                    patternType: "solid",
                    bgColor: "#E1F0FF",
                    fgColor: "#E1F0FF"
                },
                font: {
                    color: "#000000",
                    size: "10",
                    bold: true
                }
            });

            var headers = [
                "Sr.",
                "Retailer_Code",
                "Loan Account Number",
                "Client ID",
                "Branch",
                "Title",
                "Name",
                "Fathers_Title",
                "Fathers_Name",
                "Mothers_Title",
                "Mothers_Name",
                "Spouse_Title",
                "Spouse_Name",
                "Gender",
                "Date_of_Birth",
                "Birth_District",
                "Birth_Country",
                "_17_Digit_NID",
                "_10_Digit_NID",
                "TIN_Number",
                "Parmanent_Address",
                "Parmanent_Address_Post_Code",
                "Parmanent_Address_District",
                "Country_of_Permanent_Address",
                "Business_Address",
                "Business_Address_Code",
                "Business_Address_District",
                "Country_of_Business",
                "Phone",
                "Distributor Name",
                "Point Name",
                "Limit",
                "Open Date",
                "Expiry Date",
                "Prin Int Rate",
                "Service Charge",
                "Total Disbursement",
                "Total Calculated Interest",
                "Total Collection",
                "Paid Principal",
                "Paid Interest",
                //"Carry Amount",
                "Prin OS",
                "Int OS",
                "Total OS",
                "Recovery in Last Month",
                "Interest Charged in last month",
                "Recovery of last 3 Months",
                "Calculated Interest of last 3 months"
            ];

            var col = 1;
            var row = 1;
            var col_add = 0;

            headers.forEach((e) => {
                worksheet
                    .cell(row, col + col_add)
                    .string(e)
                    .style(headerStyle);
                col_add++;
            });

            row = 2;

            const outstandings = await outStandingData(till_date);

            for (let i = 0; i < result.length; i++) {

                var col_add = 0;
                let e = result[i];

                var credit_amount = (outstandings[e.outlet_code] !== undefined) ? parseFloat(outstandings[e.outlet_code].total_credit) : 0;
                var total_interest_amount = (outstandings[e.outlet_code] !== undefined) ? parseFloat(outstandings[e.outlet_code].total_interest) : 0;
                var paid_principle = (outstandings[e.outlet_code] !== undefined) ? parseFloat(outstandings[e.outlet_code].paid_principle) : 0;
                var paid_interest_amount = (outstandings[e.outlet_code] !== undefined) ? parseFloat(outstandings[e.outlet_code].paid_interest_amount) : 0;
                var paid_amount = (outstandings[e.outlet_code] !== undefined) ? parseFloat(outstandings[e.outlet_code].paid_amount) : 0;

                var total_collection = credit_amount + total_interest_amount;
                var prin_os = (outstandings[e.outlet_code] !== undefined) ? parseFloat(outstandings[e.outlet_code].principle_outstanding) : 0;
                var interest_os = (outstandings[e.outlet_code] !== undefined) ? parseFloat(outstandings[e.outlet_code].interest_outstanding) : 0;
                var total_os = (outstandings[e.outlet_code] !== undefined) ? parseFloat(outstandings[e.outlet_code].total_outstanding) : 0;

                worksheet.cell(row, col + col_add).number((i + 1));
                col_add++;
                worksheet.cell(row, col + col_add).string(e.outlet_code ? e.outlet_code : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.loan_account_number ? e.loan_account_number : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.client_id ? "" + e.client_id : "");
                col_add++;

                worksheet.cell(row, col + col_add).string(e.branch ? e.branch : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.title ? e.title : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.name ? e.name : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.father_title ? e.father_title : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.father_name ? e.father_name : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.mother_title ? e.mother_title : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.mother_name ? e.mother_name : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.spouse_title ? e.spouse_title : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.spouse_name ? e.spouse_name : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.gender ? e.gender : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.dob ? e.dob : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.birth_district ? e.birth_district : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.birth_country ? e.birth_country : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e._17_digit_nid ? e._17_digit_nid : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e._10_digit_nid ? e._10_digit_nid : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.tin_number ? e.tin_number : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.parmanent_address ? e.parmanent_address : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.parmanent_address_post_code ? e.parmanent_address_post_code : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.parmanent_address_district ? e.parmanent_address_district : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.country_of_permanent_address ? e.country_of_permanent_address : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.business_address ? e.business_address : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.business_address_code ? e.business_address_code : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.business_address_district ? e.business_address_district : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.country_of_Business ? e.country_of_Business : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.phone ? e.phone : "");
                col_add++;

                worksheet.cell(row, col + col_add).string(e.distributor_name ? e.distributor_name : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.point_name ? e.point_name : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.limit ? e.limit : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.open_date ? e.open_date : "");
                col_add++;
                worksheet.cell(row, col + col_add).string(e.end_date ? e.end_date : "");
                col_add++;
                worksheet.cell(row, col + col_add).number(e.principal_in_rate ? e.principal_in_rate : 0);
                col_add++;
                worksheet.cell(row, col + col_add).number(e.service_charge ? e.service_charge : 0);
                col_add++;
                worksheet.cell(row, col + col_add).number(outstandings[e.outlet_code] !== undefined ? credit_amount : 0);
                col_add++;
                worksheet.cell(row, col + col_add).number(outstandings[e.outlet_code] !== undefined ? total_interest_amount : 0);
                col_add++;
                worksheet.cell(row, col + col_add).number(outstandings[e.outlet_code] !== undefined ? total_collection : 0);
                col_add++;
                //worksheet.cell(row, col + col_add).number(payments[e.id_outlet] !== undefined ? paid_amount : 0);
                //col_add++;				
                worksheet.cell(row, col + col_add).number(outstandings[e.outlet_code] !== undefined ? paid_principle : 0);
                col_add++;
                worksheet.cell(row, col + col_add).number(outstandings[e.outlet_code] !== undefined ? paid_interest_amount : 0);
                col_add++;
                //worksheet.cell(row, col + col_add).number(payments[e.id_outlet] !== undefined ? payments[e.id_outlet].carry_amount : 0);
                //col_add++;

                worksheet.cell(row, col + col_add).number(prin_os ? prin_os : 0);
                col_add++;
                worksheet.cell(row, col + col_add).number(interest_os ? interest_os : 0);
                col_add++;
                worksheet.cell(row, col + col_add).number(total_os ? total_os : 0);
                col_add++;

                worksheet.cell(row, col + col_add).number(lastOneMonthData[e.outlet_code] !== undefined ? lastOneMonthData[e.outlet_code]['1'].paid_amount : 0);
                col_add++;
                worksheet.cell(row, col + col_add).number(lastOneMonthData[e.outlet_code] !== undefined ? lastOneMonthData[e.outlet_code]['1'].paid_interest_amount : 0);
                col_add++;
                worksheet.cell(row, col + col_add).number(lastThreeMonthData[e.outlet_code] !== undefined ? lastThreeMonthData[e.outlet_code]['3'].paid_amount : 0);
                col_add++;
                worksheet.cell(row, col + col_add).number(lastThreeMonthData[e.outlet_code] !== undefined ? lastThreeMonthData[e.outlet_code]['3'].paid_interest_amount : 0);
                col_add++;
                row++;
            }
            const file_path = process.env.PUBLIC_URL + 'eKyc_documents/';
            if (!fs.existsSync(file_path)) {
                fs.mkdirSync(file_path, { recursive: true });
            }
            workbook.write(file_path + "Customer_Report_Download.xlsx");
            const fileName = "eKyc_documents/Customer_Report_Download.xlsx";
            await timeout(30000);
			const url = generateBlobDownloadURL(fileName);
            resolve(sendApiResult(true, "Customer Report Download", url));
        }
    })
}


// Develop by moin
const nidDataFatchFromPrsim = async () =>{
    try {
        const nidMasterDataV2LastId = await knex("nid_master_data_v2").select('*').orderBy('id', 'desc').limit(1);
        const nidPoricoyRequestLogsLastId = await knex("nid_poricoy_request_log").select('*').orderBy('id', 'desc').limit(1);
        
        const response = await axios({
			url: `https://newprism.net/unnoti_nid/unnoti_nid_data_fetch/${nidPoricoyRequestLogsLastId[0].id}/${nidMasterDataV2LastId[0].id}`,
			method: "get",
		});
        
        if(response.data.nid_poricoy_request.length > 0){
            let nidPoricoyRequest = response.data.nid_poricoy_request;
            nidPoricoyRequest.map(value => {
                delete value.id;
                return value;
            });
            await knex("nid_poricoy_request_log").insert(nidPoricoyRequest); 
        }
        if(response.data.nid_master_data.length > 0){
            let nidMasterData = response.data.nid_master_data;
            nidMasterData.map(value => {
                delete value.id;
                return value;
            });
            await knex("nid_master_data_v2").insert(nidMasterData);
        }
	} catch (err) {
        console.log(err);
	}
}


ReportModel.nidMasterDataReport = async (req, res) => {
    var url = require('url');
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var dpids = req.body.dpids;
    var filterText = req.body.filterText;
    return new Promise(async (resolve, reject) => {
        try {
            if(query.page == 1){
                await nidDataFatchFromPrsim();
            }
            let data = await knex("cr_retail_limit")
                .select(
                    knex.raw("distributorspoint.name as dp_name"),
                    knex.raw("company.name as dh_name"),
                    "cr_retail_limit.id",
                    "cr_retail_limit.outlet_code",
                    "cr_retail_limit.outlet_name",
                    "cr_retail_limit.owner_name",
                    "cr_retail_limit.phone",
                    "cr_retail_limit.address"
                )
                .innerJoin("distributorspoint", "distributorspoint.id", "cr_retail_limit.id_point")
                .innerJoin("company", "distributorspoint.dsid", "company.id")
                .innerJoin("nid_master_data_v2", "nid_master_data_v2.outlet_code", "cr_retail_limit.outlet_code")
                .where(function () {
                    if (filterText) {
                        var search_param = filterText.toLowerCase().replace(/\s/g, '');
                        this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                    }
                })
                .whereIn("cr_retail_limit.id_point", dpids)
                .where('nid_master_data_v2.show_status', 1)
                .where("cr_retail_limit.activation_status", "Active")
                .where("cr_retail_limit.kyc_status", "Pending")
                .paginate({
                    perPage: query.per_page,
                    currentPage: query.page,
                    isLengthAware: true
                });

            resolve(sendApiResult(true, "Data successfully fetched.", data));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

module.exports = ReportModel;
