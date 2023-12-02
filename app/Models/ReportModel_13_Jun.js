const {sendApiResult} = require("../controllers/helperController");
const knex = require('../config/database');
var moment = require('moment');
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
                        let month = arraySearch(months,k) + 1;
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
                                id_outlet: typeof retailObj !== 'undefined' ?  retailObj.id : null,
                                id_dh: typeof retailObj !== 'undefined' ?  retailObj.dsid : null,
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
                    resolve(sendApiResult(false,"No data found."));
                }else{
                    const insert =await trx.batchInsert("cr_sales_history",masterArray, 50);

                    if (insert == 0) reject(sendApiResult(false,"Server Error", masterArray));

                    let msg = "File imported successfully!";

                    resolve(sendApiResult(true,msg, insert));
                }
            }).then((result) => {
                resolve(sendApiResult(true,result));
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

const arraySearch = (arr,val) => {
    for (var i=0; i<arr.length; i++)
        if (arr[i] === val)                    
            return i;
    return false;
}

ReportModel.disbursements = async (req,res)=>{
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
            var scopeOutlets =  await knex("cr_retail_limit")
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
                                        .leftJoin("distributorspoint", "distributorspoint.id", "cr_retail_limit.id_point")
                                        .leftJoin("company", "distributorspoint.dsid", "company.id")
                                        .leftJoin("cr_credit_disbursements", "cr_credit_disbursements.id_outlet", "cr_retail_limit.id_outlet")
                                        .where(function() {
                                            this.whereIn("cr_retail_limit.id_point", dpids);    
                                            this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);                                        
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
                                        .orderBy("cr_retail_limit.id_outlet", "cr_credit_disbursements.sys_date")
                                        // .groupBy("cr_retail_limit.id_outlet")
                                        .paginate({ 
                                            perPage: query.per_page,
                                            currentPage: query.page,
                                            isLengthAware: true
                                        });
            if(scopeOutlets == 0) resolve(sendApiResult(false,"Data not found",scopeOutlets));
            var scopeOutletsForTotal =  await knex("cr_retail_limit")
                                        .select( 
                                            knex.raw(`sum(cr_credit_disbursements.credit_amount) as total`)                                        
                                        )
                                        .leftJoin("cr_credit_disbursements", "cr_credit_disbursements.id_outlet", "cr_retail_limit.id_outlet")
                                        .where(function() {
                                            this.whereIn("cr_retail_limit.id_point", dpids);    
                                            this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);                                        
                                            if (filterText) {
                                                var search_param = filterText.toLowerCase().replace(/\s/g, '');
                                                this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                                            }
                                        })
                                        .where("cr_retail_limit.activation_status", "Active")
                                        .orderBy("cr_retail_limit.id_outlet", "cr_credit_disbursements.sys_date")
                                        .first();
            var totalAmount = parseFloat(scopeOutletsForTotal.total);
            scopeOutlets.total_amount = totalAmount.toFixed(2);
            resolve(sendApiResult(true, "Data successfully fetched.", scopeOutlets));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

ReportModel.payments = async (req,res)=>{
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
            var scopeOutlets =  await knex("cr_retail_limit")
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
                                        .leftJoin("distributorspoint", "distributorspoint.id", "cr_retail_limit.id_point")
                                        .leftJoin("company", "distributorspoint.dsid", "company.id")
                                        .leftJoin("cr_credit_payments", "cr_credit_payments.id_outlet", "cr_retail_limit.id_outlet")
                                        .where(function() {
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
            if(scopeOutlets == 0) resolve(sendApiResult(false,"Data not found",scopeOutlets));
            var scopeOutletsForTotal =  await knex("cr_retail_limit")
                                        .select(
                                            knex.raw(`sum(cr_credit_payments.paid_amount) as total`)
                                        )
                                        .leftJoin("cr_credit_payments", "cr_credit_payments.id_outlet", "cr_retail_limit.id_outlet")
                                        .where(function() {
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

ReportModel.dateWiseDisbPayByRoute = async (req)=>{
    return new Promise(async(resolve,reject)=>{
        try {
            var output= {};
            const totalDisbursed = await knex("cr_credit_disbursements")
                                .sum({total_disbursed:'cr_credit_disbursements.credit_amount'})
                                .leftJoin("retailers", "retailers.id", "cr_credit_disbursements.id_outlet")
                                .where("retailers.rtid", req.params.route_id)
                                .where("cr_credit_disbursements.sys_date", req.params.date);
            output.total_disbursed = totalDisbursed[0].total_disbursed ? totalDisbursed[0].total_disbursed : 0;
            const totalPaid = await knex("cr_credit_payments")
                                .sum({total_paid:'cr_credit_payments.paid_amount'})
                                .leftJoin("retailers", "retailers.id", "cr_credit_payments.id_outlet")
                                .where("retailers.rtid", req.params.route_id)
                                .where("cr_credit_payments.sys_date", req.params.date);
            output.total_paid = totalPaid[0].total_paid ? totalPaid[0].total_paid : 0;
            resolve(sendApiResult(true,"Data fetched successfully",output));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

ReportModel.registrationInformation = async (req) => {
    console.log(req.routeSections)
    return new Promise(async(resolve,reject)=>{
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
                                        .where(function() {
                                            if (req.routeSections){
                                                this.whereIn(knex.raw(`concat(routes.number,section_days.slug)`), req.routeSections)
                                            }
                                            if (req.dpids) {
                                                this.whereIn("cr_retail_limit.id_point",  req.dpids);
                                            }
                                        })
                                        .where("routes.stts", 1)
                                        .where("cr_retail_limit.activation_status", "Active").first();
            resolve(sendApiResult(true,"Data fetched successfully",data));
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
                                        kyc_status : "Doc Submitted" 
                                    });
                if (update == 0) {
                    resolve(sendApiResult(false,"Nothing to update"));
                }else{
                    const insert = await knex("cr_doc_submitted_atachments")
                                    .insert({
                                        "attachment": filePath,
                                        "created_by": req.user_id
                                    });
                    resolve(sendApiResult(true,"Successfully Submitted!",update));
                }                
            }else{
                resolve(sendApiResult(false,"No Outlet Found"));
            }            
        } catch (error) {
            resolve(sendApiResult(false,"Something bad happened!",error));
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
                select += ` AND crl.id_point IN (${ req.dpids.join()})`;
            }
            if (req.routeSections) {
                select += ` AND concat( r.number, s.slug ) IN ('${ req.routeSections.join("','")}')`;
            }
            select +=` ),
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
                select += ` AND crl.id_point IN (${ req.dpids.join()})`;
            }
            if (req.routeSections) {
                select += ` AND concat( r.number, s.slug ) IN ('${ req.routeSections.join("','")}')`;
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
                select += ` AND crl.id_point IN (${ req.dpids.join()})`;
            }
            if (req.routeSections) {
                select += ` AND concat( r.number, s.slug ) IN ('${ req.routeSections.join("','")}')`;
            }
            select +=`) AS max_loan_limit,
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
                select += ` AND crl.id_point IN (${ req.dpids.join()})`;
            }
            if (req.routeSections) {
                select += ` AND concat( r.number, s.slug ) IN ('${ req.routeSections.join("','")}')`;
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
                select += ` AND crl.id_point IN (${ req.dpids.join()})`;
            }
            if (req.routeSections) {
                select += ` AND concat( r.number, s.slug ) IN ('${ req.routeSections.join("','")}')`;
            }
            select +=`)
                            ) * 100 
                        ),2), '%') AS utilization_rate`;
            var data =  await knex("cr_credit_disbursements")
                                        .select(knex.raw(select))
                                        .leftJoin("cr_retail_limit", "cr_credit_disbursements.id_outlet", "cr_retail_limit.id_outlet")
                                        .leftJoin("retailers", "retailers.id", "cr_retail_limit.id_outlet")
                                        .leftJoin("routes", "routes.id", "retailers.rtid")
                                        .leftJoin("section_days", "routes.section", "section_days.section")
                                        .where(function() {
                                            if (req.dpids) {
                                                this.whereIn("cr_retail_limit.id_point",  req.dpids);
                                            }
                                            if (req.routeSections) {
                                                this.whereIn(knex.raw(`concat( routes.number, section_days.slug )`),  req.routeSections);
                                            }
                                            if (req.fromDate) {
                                                this.where("cr_credit_disbursements.sys_date",  '>=',req.fromDate);
                                            }
                                            if (req.toDate) {
                                                this.where("cr_credit_disbursements.sys_date",  '<=',req.toDate);
                                            }
                                        })
                                        .where("cr_retail_limit.activation_status", "Active")
                                        .groupBy("cr_credit_disbursements.sys_date")
                                        .paginate({ 
                                            perPage: req.countPerPage,
                                            currentPage: req.page,
                                            isLengthAware: true
                                        });
                                        
            if(data == 0 || !data.data[0].date){
                resolve(sendApiResult(false,"Data not found",[]));
            }
            else{
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
                select += ` AND crl.id_point IN (${ req.dpids.join()})`;
            }
            if (req.selectedOutlets) {
                select += ` AND crl.id_outlet IN (${ req.selectedOutlets.join()})`;
            }
            select +=` ),
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
                select += ` AND crl.id_point IN (${ req.dpids.join()})`;
            }
            if (req.selectedOutlets) {
                select += ` AND crl.id_outlet IN (${ req.selectedOutlets.join()})`;
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
                select += ` AND crl.id_point IN (${ req.dpids.join()})`;
            }
            if (req.selectedOutlets) {
                select += ` AND crl.id_outlet IN (${ req.selectedOutlets.join()})`;
            }
            select += `),
                                        0 
                                    ) - sum( cr_credit_disbursements.paid_amount ) - sum( cr_credit_disbursements.total_interest_amount - cr_credit_disbursements.total_paid_interest_amount ) + sum( cr_credit_disbursements.credit_amount ) 
                                ) / cr_retail_limit.allowed_limit
                            ) * 100 
                        ),2), '%') AS utilization_rate`;
            var data =  await knex("cr_credit_disbursements")
                                        .select(knex.raw(select))
                                        .leftJoin("cr_retail_limit", "cr_credit_disbursements.id_outlet", "cr_retail_limit.id_outlet")
                                        .leftJoin("retailers", "retailers.id", "cr_retail_limit.id_outlet")
                                        .leftJoin("routes", "routes.id", "retailers.rtid")
                                        .leftJoin("section_days", "routes.section", "section_days.section")
                                        .where(function() {
                                            if (req.dpids) {
                                                this.whereIn("cr_retail_limit.id_point",  req.dpids);
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
                                        
            if(data == 0 || !data.data.length){
                resolve(sendApiResult(false,"Data not found",[]));
            }
            else{
                resolve(sendApiResult(true, "Data successfully fetched.", data));
            }

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

ReportModel.getBadDebtsOutlets =  function(req) {
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
                    cr_credit_disbursements.due_amount
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
                .where("retail.kyc_status","Approved")
                .where("cr_disbursement_wise_interest.is_penalty_interest", 1)
                .whereNot("cr_credit_disbursements.due_amount", 0)
                .orderBy("retail.id", "asc")
                .groupBy("retail.outlet_code")
                .paginate({ 
                    perPage: req['per_page'], 
                    currentPage: req['current_page'], 
                    isLengthAware: true 
                });
            console.log(data);
            resolve(sendApiResult(true, "Outlet Without Doc Uploaded Fetched", data));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

ReportModel.paymentMadeByDhToFi = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {            
            var data =  await knex({cp : "cr_credit_payments"})
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
                            .innerJoin({cph : "cr_credit_payment_histories"}, function() {
                                this.on("cph.id_outlet", "=", "cp.id_outlet")
                                .on("cp.sys_date", "=", "cph.sys_date")
                            })
                            .leftJoin({crl : "cr_retail_limit"}, "crl.id_outlet", "cp.id_outlet")
                            .where(function() {
                                if (req.dpids) {
                                    this.whereIn("crl.id_point",  req.dpids);
                                }
                                if (req.fromDate) {
                                    this.where("cp.sys_date",  '>=',req.fromDate);
                                }
                                if (req.toDate) {
                                    this.where("cp.sys_date",  '<=',req.toDate);
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
                                        
            if(data == 0){
                resolve(sendApiResult(false,"Data not found",[]));
            }
            else{
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
            var data =  await knex({cd : "cr_credit_disbursements"})
                            .select(
                                "dh.name AS dh_name",
                                "crl.outlet_code",
                                "crl.outlet_name",
                                knex.raw("count( cd.id_outlet ) AS total_credit_memo_transaction"),
                                knex.raw(`(
                                        SELECT
                                            count( cp.id_outlet )
                                        FROM
                                            cr_credit_payments cp
                                        LEFT JOIN cr_retail_limit AS crl ON crl.id_outlet = cp.id_outlet
                                        WHERE
                                            cd.id_outlet = cp.id_outlet
                                            AND cp.paid_amount > 0
                                            AND crl.id_point IN (${req.dpids.join()})
                                            AND cp.sys_date BETWEEN '${req.fromDate}'
                                            AND '${req.toDate}'
                                        ) AS total_credit_payment`
                                )
                            )
                            .leftJoin({crl : "cr_retail_limit"}, "crl.id_outlet", "cd.id_outlet")
                            .leftJoin({dh : "company"}, "dh.id", "crl.id_dh")
                            .where(function() {
                                if (req.dpids) {
                                    this.whereIn("crl.id_point",  req.dpids);
                                }
                                if (req.fromDate) {
                                    this.where("cd.sys_date",  '>=',req.fromDate);
                                }
                                if (req.toDate) {
                                    this.where("cd.sys_date",  '<=',req.toDate);
                                }
                                if (filterText) {
                                    var search_param = filterText.toLowerCase().replace(/\s/g, '');
                                    this.whereRaw(`LOWER(REPLACE(crl.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                                }
                            })
                            .where("crl.activation_status", "Active")
                            .groupBy("crl.outlet_code")
                            .paginate({ 
                                perPage: req.per_page,
                                currentPage: req.current_page,
                                isLengthAware: true
                            });
                                        
            if(data == 0){
                resolve(sendApiResult(false,"Data not found",[]));
            }
            else{
                resolve(sendApiResult(true, "Data successfully fetched.", data));
            }

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

ReportModel.outletWiseCreditInfo = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {            
            var filterText = req.filterText;
            var data =  await knex("cr_credit_payments")
                            .select(
                                knex.raw("dh.name AS dh_name"),
                                "cr_retail_limit.outlet_code",
	                            "cr_retail_limit.outlet_name",
                                knex.raw("( SELECT sum( cr_credit_disbursements.credit_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_credit_payments.id_outlet ) AS loan_taken"),
                                knex.raw("( SELECT sum( cr_credit_disbursements.due_amount + cr_credit_disbursements.total_interest_amount - cr_credit_disbursements.total_paid_interest_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_credit_payments.id_outlet ) AS due_amount"),
                                knex.raw("sum( cr_credit_payments.paid_amount ) AS paid_amount"),
                                knex.raw("( SELECT sum( cr_credit_disbursements.paid_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_credit_payments.id_outlet ) AS paid_principle"),
                                knex.raw("( SELECT sum( cr_credit_disbursements.total_paid_interest_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_credit_payments.id_outlet ) AS paid_interest_amount"),
                                knex.raw(`(
                                        sum( cr_credit_payments.paid_amount ) - ( SELECT sum( cr_credit_disbursements.paid_amount + cr_credit_disbursements.total_paid_interest_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_credit_payments.id_outlet ) 
                                    ) AS carry_amount`
                                )
                            )
                            .leftJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "cr_credit_payments.id_outlet")
                            .leftJoin({dh : "company"}, "dh.id", "cr_retail_limit.id_dh")
                            .where(function() {
                                this.whereNot("cr_retail_limit.id_dh", 57);
                                if (filterText) {
                                    var search_param = filterText.toLowerCase().replace(/\s/g, '');
                                    this.whereRaw(`LOWER(REPLACE(crl.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                                }
                            })
                            .groupBy("cr_credit_payments.id_outlet")
                            .orderBy("outlet_code", "asc")
                            .paginate({ 
                                perPage: req.per_page,
                                currentPage: req.current_page,
                                isLengthAware: true
                            });
                                        
            if(data == 0){
                resolve(sendApiResult(false,"Data not found",[]));
            }
            else{
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
            var comparingDay =  moment().add(-14, 'days').format('YYYY-MM-DD');

            var data = await knex("cr_credit_disbursements")
                                        .select("cr_credit_disbursements.due_amount")
                                        .where("cr_credit_disbursements.due_amount",  '>',0)
                                        .where("cr_credit_disbursements.sys_date",  '<=',comparingDay)
                                        .where("cr_credit_disbursements.id_outlet", req.params.id_outlet);
            var due = 0;
            console.log(data);
            if (data == 0) {
               var message = 'No debt';
               var data = {
                message: message,
                due: 0,
              };
            }else{
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
    return new Promise(async (resolve, reject) => {
        try {            
            var filterText = req.filterText;
            var data =  await knex("cr_retail_limit")
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
                            .leftJoin({dh : "company"}, "dh.id", "cr_retail_limit.id_dh")
                            .leftJoin("distributorspoint", "cr_retail_limit.id_point", "distributorspoint.id")
                            .innerJoin("cr_credit_disbursements", "cr_retail_limit.id_outlet", "cr_credit_disbursements.id_outlet")
                            .where(function() {
                                this.whereNot("cr_retail_limit.id_dh", 57);
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
                                        
            if(data == 0){
                resolve(sendApiResult(false,"Data not found",[]));
            }
            else{
                resolve(sendApiResult(true, "Data successfully fetched.", data));
            }

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

module.exports = ReportModel;
