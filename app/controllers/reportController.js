const xlsx = require('xlsx')
const { sendApiResult, generaeteExcel, getFiBaseDpids, getPostCode, createExcle, sliceIntoChunks, generateBlobDownloadURL } = require("./helperController")
const ReportModel = require("../Models/ReportModel");
const knex = require('../config/database');
const excel = require('excel4node');
var moment = require('moment');

exports.uploadSalesData = async (req, res) => {

    try {
        var resData = [];
        var workbook = xlsx.readFile(process.env.PUBLIC_URL + 'yearly-sales-file/' + req.file.filename, { type: "array" });
        const sheetnames = Object.keys(workbook.Sheets);
        const sheetname = sheetnames[0];
        resData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetname]);

        let insert = await ReportModel.bulkSalesUpload(resData, req);
        res.status(200).send(insert);

    } catch (error) {
        return sendApiResult(false, 'File not uploaded');
    }
}

exports.downLoadSalesreport = async (req, res) => {
    try {
        const date = new Date();
        const current_year = date.getFullYear();
        const current_mnth = date.getMonth() + 1; // 1=January, 2=February ...
        const current_yr_mnth_combination = [];
        const prev_yr_mnth_combination = [];
        console.log('Month Year processing start');
        for (let i = 1; i <= current_mnth - 1; i++) {
            current_yr_mnth_combination.push(`${i}${current_year}`);
        }
        for (let i = current_mnth; i <= 12; i++) {
            prev_yr_mnth_combination.push(`${i}${current_year - 1}`);
        }
        console.log('Month Year processing end');
        console.log('Query processing start');
        const data = await knex("cr_sales_history")
            //.where("year", req.body.year)
            .where((q) => {
                q.whereRaw(`1 = 1`);
                if (current_yr_mnth_combination.length) {
                    q.orWhereRaw(`CONCAT(month,year) IN (${current_yr_mnth_combination.join()})`);
                }
                if (prev_yr_mnth_combination.length) {
                    q.orWhereRaw(`CONCAT(month,year) IN (${prev_yr_mnth_combination.join()})`);
                }
            })
            .whereIn("id_point", req.body.dpids)
            .orderBy('year', 'desc')
            .orderBy('month', 'asc');
        //console.log(data)
        console.log('Query processing end');
        var report_obj = {};
        console.log('Initialization of report_obj');
        for (let i = 0; i < data.length; i++) {
            console.log(`---------------Parent for loop count: ${i}---------------`);
            const e = data[i];
            let temp = {};
            console.log(`Child loop start`);
            for (let j = 0; j < data.length; j++) {
                console.log(`Child loop count: ${j}`);
                const elm = data[j];
                if (e.outlet_code == elm.outlet_code) {
                    let outlet_code = elm.outlet_code;
                    let owner_name = elm.owner_name;
                    let outlet_name = elm.outlet_name;
                    let contact = elm.contact;
                    let address = elm.address;
                    let region = elm.region;
                    let area = elm.area;
                    let distribution_house = elm.distribution_house;
                    let territory = elm.territory;
                    let point = elm.point;
                    let route_section = elm.route_section;
                    let route = elm.route;
                    let section = elm.section;
                    let month = elm.month;
                    let year = elm.year;
                    let top_sale_amount = elm.top_sale_amount;
                    temp[elm.month] = {
                        outlet_code,
                        owner_name,
                        outlet_name,
                        contact,
                        address,
                        region,
                        area,
                        distribution_house,
                        territory,
                        point,
                        route_section,
                        route,
                        section,
                        month,
                        year,
                        top_sale_amount
                    };
                }
            }
            console.log(`Child loop end`);
            report_obj[e.outlet_code] = temp;
        }
        console.log('report_obj processing finished');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var headers = ["SL No.", "Region", "Area", "Distribution House", "Territory", "Point", "Route/Section", "Route", "Section", "Outlet Code", "Owner Name", "Outlet Name", "Contact", "Address"];

        for (let i = current_mnth; i <= 12; i++) {
            const month = months[i - 1];
            const shortYear = (current_year - 1) % 100;
            headers.push(month + '-' + shortYear);
        }

        for (let i = 1; i <= current_mnth - 1; i++) {
            const month = months[i - 1];
            const shortYear = (current_year) % 100;
            headers.push(month + '-' + shortYear);
        }
        var workbook = new excel.Workbook();
        var worksheet = workbook.addWorksheet('Sheet 1');
        var headerStyle = workbook.createStyle({
            fill: {
                type: 'pattern',
                patternType: 'solid',
                bgColor: '#E1F0FF',
                fgColor: '#E1F0FF',
            },
            font: {
                color: "#000000",
                size: "10",
                bold: true
            }
        });
        console.log('Excel write start');
        var col = 1;
        var row = 1;
        var col_add = 0;
        headers.forEach(e => {
            worksheet.cell(row, col + col_add).string(e).style(headerStyle);
            col_add++;
        });
        row++;
        var count = 0;
        for (var key of Object.keys(report_obj)) {
            console.log('New row is adding.');
            var col_add = 0;
            let e = report_obj[key];
            worksheet.cell(row, col + col_add).number(++count); col_add++;

            worksheet.cell(row, col + col_add).string(e[1].region ? e[1].region : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e[1].area ? e[1].area : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e[1].distribution_house ? e[1].distribution_house : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e[1].territory ? e[1].territory : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e[1].point ? e[1].point : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e[1].route_section ? e[1].route_section : ''); col_add++;
            worksheet.cell(row, col + col_add).number(e[1].route ? e[1].route : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e[1].section ? e[1].section : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e[1].outlet_code ? e[1].outlet_code : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e[1].owner_name ? e[1].owner_name : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e[1].outlet_name ? e[1].outlet_name : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e[1].contact ? e[1].contact : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e[1].address ? e[1].address : ''); col_add++;
            for (var k of Object.keys(e)) {
                const elm = e[k];
                worksheet.cell(row, col + col_add).number(elm.top_sale_amount ? parseFloat(elm.top_sale_amount) : 0); col_add++;
            }
            row++;
        }
        workbook.write(process.env.PUBLIC_URL + 'reports/sales_report.xlsx');
        console.log('Excel write end');
        const fileName = "reports/sales_report.xlsx";
        const url = generateBlobDownloadURL(fileName);
        console.log('waiting for file write start');
        await timeout(1500);
        console.log('waiting for file write end');
        res.send(sendApiResult(true, "Sample File Generated", url));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

const timeout = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

exports.disbursements = async (req, res) => {
    try {
        const outlets = await ReportModel.disbursements(req);
        res.status(200).send(outlets);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

// exports.disbursementsDownload = async (req, res) => {
//     var url = require('url');
//     var url_parts = url.parse(req.url, true);
//     var query = url_parts.query;
//     var dpids = req.body.dpids;
//     var fromDate = req.body.dateFrom ? req.body.dateFrom : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
//     var toDate = req.body.dateTo ? req.body.dateTo : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
//     var filterText = req.body.filterText;
//     try {
//         const data = await knex("cr_retail_limit")
//             .select(
//                 "cr_retail_limit.id",
//                 "cr_retail_limit.outlet_code",
//                 "cr_retail_limit.outlet_name",
//                 "cr_retail_limit.owner_name",
//                 "cr_retail_limit.phone",
//                 "cr_retail_limit.address",
//                 knex.raw("distributorspoint.name as dp_name"),
//                 knex.raw("company.name as dh_name"),
//                 //knex.raw(`sum(cr_credit_disbursements.credit_amount) as credit_amount`),
//                 'cr_credit_disbursements.credit_amount',
//                 'cr_credit_disbursements.invoice_amount',
//                 'cr_credit_disbursements.cash_payment',
//                 knex.raw(`DATE_FORMAT(cr_credit_disbursements.sys_date, "%d-%b-%Y") as sys_date`)
//             )
//             .innerJoin("distributorspoint", "distributorspoint.id", "cr_retail_limit.id_point")
//             .innerJoin("company", "distributorspoint.dsid", "company.id")
//             .innerJoin("cr_credit_disbursements", "cr_credit_disbursements.id_outlet", "cr_retail_limit.id_outlet")
//             .where(function () {
//                 this.whereIn("cr_retail_limit.id_point", dpids);
//                 this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);
//                 if (filterText) {
//                     var search_param = filterText.toLowerCase().replace(/\s/g, '');
//                     this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
//                 }
//             })
//             // .where(function() {
//             //     this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);
//             //     this.orWhereBetween('cr_retail_limit.end_date', [fromDate, toDate]);
//             // })
//             //.where("cr_retail_limit.kyc_status", "Initial")
//             // .whereNotIn("cr_retail_limit.id_point", [334,344])
//             .where("cr_retail_limit.activation_status", "Active")
//             .orderBy("cr_retail_limit.id_outlet", "cr_credit_disbursements.sys_date");
//         // .groupBy("cr_retail_limit.id_outlet");
//         const header = {
//             'dh_name': 'House',
//             'dp_name': 'Point',
//             'outlet_code': 'Outlet Code',
//             'outlet_name': 'Outlet Name',
//             'owner_name': 'Owner Name',
//             'phone': 'Phone',
//             'address': 'Address',
//             'credit_amount': 'Disbursed Cr Amount',
//             'invoice_amount': 'Invoice Amount',
//             'cash_payment': 'Cash Amount',
//             'sys_date': 'Date'
//         }
//         const numberCast = ["credit_amount", "invoice_amount", "cash_payment"];
//         const fileName = generaeteExcel(header, data, 'Disbursements_Day_Wise', numberCast);
//         await timeout(10000);
//         res.send(sendApiResult(true, "File Generated", fileName));
//     } catch (error) {
//         res.send(sendApiResult(false, error.message));
//     }
// }

exports.disbursementsDownload = async (req, res) => {
    var url = require('url');
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var dpids = req.body.dpids;
    var fromDate = req.body.dateFrom ? req.body.dateFrom : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
    var toDate = req.body.dateTo ? req.body.dateTo : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
    var filterText = req.body.filterText;
    try {
        const data = await knex("cr_retail_limit")
            .select(
                knex.raw("company.name as dh_name"),
                knex.raw("distributorspoint.name as dp_name"),
                "cr_retail_limit.outlet_code",
                "cr_retail_limit.outlet_name",
                "cr_retail_limit.owner_name",
                "cr_retail_limit.phone",
                "cr_retail_limit.address", 'cr_credit_disbursements.credit_amount',
                'cr_credit_disbursements.invoice_amount',
                'cr_credit_disbursements.cash_payment',
                knex.raw(`DATE_FORMAT(cr_credit_disbursements.sys_date, "%d-%b-%Y") as sys_date`)
            )
            .leftJoin("distributorspoint", "distributorspoint.id", "cr_retail_limit.id_point")
            .leftJoin("company", "distributorspoint.dsid", "company.id")
            .leftJoin("cr_credit_disbursements", "cr_credit_disbursements.id_outlet", "cr_retail_limit.id_outlet")
            .where(function () {
                this.whereIn("cr_retail_limit.id_point", dpids);
                this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);
                if (filterText) {
                    var search_param = filterText.toLowerCase().replace(/\s/g, '');
                    this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                }
            })
            // .where("cr_retail_limit.kyc_status", "Initial")
            .where("cr_retail_limit.activation_status", "Active")
            .orderBy("cr_retail_limit.id_outlet", "cr_credit_disbursements.sys_date")
        // .groupBy("cr_retail_limit.id_outlet");

        let header = [
            { header: 'SN', key: 'sn', width: 10 },
            { header: 'House', key: 'dh_name', width: 36 },
            { header: 'Point', key: 'dp_name', width: 16 },
            { header: 'Outlet Code', key: 'outlet_code', width: 13 },
            { header: 'Outlet Name', key: 'outlet_name', width: 33 },
            { header: 'Owner Name', key: 'owner_name', width: 27 },
            { header: 'Phone', key: 'phone', width: 17 },
            { header: 'Address', key: 'address', width: 34 },
            { header: 'Disbursed Cr Amount', key: 'credit_amount', width: 19 },
            { header: 'Invoice Amount', key: 'invoice_amount', width: 14 },
            { header: 'Cash Amount', key: 'cash_payment', width: 12 },
            { header: 'Date', key: 'sys_date', width: 12 },
        ]

        let chunkData = sliceIntoChunks(data, 1000000);

        let fileName = [];
        let singelFileName;
        let downloadFileName;
        let prefixFileName = 'disbursement_report/disbursement';
        chunkData.forEach(async function (val, key) {
            index = key + 1;
            if (chunkData.length == 1) {
                singelFileName = `${process.env.PUBLIC_URL}${prefixFileName}_(${fromDate} - ${toDate}).xlsx`;
                downloadFileName = `${prefixFileName}_(${fromDate} - ${toDate}).xlsx`;
            }
            else {
                singelFileName = `${process.env.PUBLIC_URL}${prefixFileName}_${index}_(${fromDate} - ${toDate}).xlsx`;
                downloadFileName = `${prefixFileName}_${index}_(${fromDate} - ${toDate}).xlsx`;
            }
            let options = {
                'addSerialNumber': true,
                'dataType': {
                    'invoice_amount': 'float',
                    'cash_payment': 'float',
                }
            };
            createExcle(header, singelFileName, val, options);
            console.log(downloadFileName);
            const url = generateBlobDownloadURL(downloadFileName);
            console.log(url);
            fileName.push(url);
        });
        // console.log(fileName);
        await timeout(fileName.length * 15000);
        res.send(sendApiResult(true, "File Generated", fileName));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.payments = async (req, res) => {
    try {
        const outlets = await ReportModel.payments(req);
        res.status(200).send(outlets);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

// exports.paymentsDownload = async (req, res) => {
//     var url = require('url');
//     var url_parts = url.parse(req.url, true);
//     var query = url_parts.query;
//     var dpids = req.body.dpids;
//     var fromDate = req.body.dateFrom ? req.body.dateFrom : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
//     var toDate = req.body.dateTo ? req.body.dateTo : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
//     var filterText = req.body.filterText;
//     try {
//         const data = await knex("cr_retail_limit")
//             .select(
//                 "cr_retail_limit.id",
//                 "cr_retail_limit.outlet_code",
//                 "cr_retail_limit.outlet_name",
//                 "cr_retail_limit.owner_name",
//                 "cr_retail_limit.phone",
//                 "cr_retail_limit.address",
//                 knex.raw("distributorspoint.name as dp_name"),
//                 knex.raw("company.name as dh_name"),
//                 knex.raw(`sum(cr_credit_payments.paid_amount) as paid_amount`),
//                 knex.raw(`sum(cr_credit_payments.paid_principle) as paid_principle`),
//                 knex.raw(`sum(cr_credit_payments.paid_interest_amount) as paid_interest_amount`),
//                 knex.raw(`DATE_FORMAT(cr_credit_payments.sys_date , "%d %b %Y") AS sys_date`),
// 				"cr_interest_settings.interest_percentage AS interest_rate",
// 				"cr_interest_settings.service_charge_percentage AS service_charge",
//             )
//             .innerJoin("distributorspoint", "distributorspoint.id", "cr_retail_limit.id_point")
//             .innerJoin("company", "distributorspoint.dsid", "company.id")
//             .innerJoin("cr_credit_payments", "cr_credit_payments.id_outlet", "cr_retail_limit.id_outlet")
// 			.innerJoin("cr_interest_settings", "cr_retail_limit.outlet_code", "cr_interest_settings.outlet_code")
//             .where(function () {
//                 this.whereIn("cr_retail_limit.id_point", dpids);
//                 this.whereBetween('cr_credit_payments.sys_date', [fromDate, toDate]);
//                 if (filterText) {
//                     var search_param = filterText.toLowerCase().replace(/\s/g, '');
//                     this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
//                 }
//             })
//             // .where(function() {
//             //     this.whereBetween('cr_credit_disbursements.sys_date', [fromDate, toDate]);
//             //     this.orWhereBetween('cr_retail_limit.end_date', [fromDate, toDate]);
//             // })
//             //.where("cr_retail_limit.kyc_status", "Initial")
// 			.whereNotIn("cr_retail_limit.id_point", [334,344])
//             .where("cr_retail_limit.activation_status", "Active")
//             // .groupBy("cr_retail_limit.id_outlet")
//             .groupBy("cr_credit_payments.id")
//             .orderBy("cr_retail_limit.id_outlet", "cr_credit_disbursements.sys_date");
//         const header = {
//             'dh_name': 'House',
//             'dp_name': 'Point',
//             'outlet_code': 'Outlet Code',
//             'outlet_name': 'Outlet Name',
//             'owner_name': 'Owner Name',
//             'phone': 'Phone',
//             'address': 'Address',
// 			'interest_rate': 'Interest Rate',
// 			'service_charge': 'Service Charge',
//             'paid_amount': 'Paid Amount',
//             'paid_principle': 'Paid Principle Amount',
//             'paid_interest_amount': 'Paid Interest Amount',
//             'sys_date': 'Date'
//         }
//         var excel_name = 'Payments_Day_Wise';
//         const numberCast = ["paid_amount", "paid_principle", "paid_interest_amount", "interest_rate", "service_charge"];
//         // const fileName = generaeteExcel(header, data,'Payments_Day_Wise', numberCast);
//         const fileName = generaeteExcel(header, data, excel_name, numberCast);
//         await timeout(10000);
//         res.send(sendApiResult(true, "File Generated", fileName));
//     } catch (error) {
//         res.send(sendApiResult(false, error.message));
//     }
// }

// exports.paymentsDownload = async (req, res) => {
//     var url = require('url');
//     var url_parts = url.parse(req.url, true);
//     var query = url_parts.query;
//     var dpids = req.body.dpids;
//     var fromDate = req.body.dateFrom ? req.body.dateFrom : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
//     var toDate = req.body.dateTo ? req.body.dateTo : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
//     var filterText = req.body.filterText;
//     try {
//         const data = await knex("cr_retail_limit")
//             .select(
//                 // "cr_retail_limit.id",
//                 knex.raw("company.name as dh_name"),
//                 knex.raw("distributorspoint.name as dp_name"),
//                 "cr_retail_limit.outlet_code",
//                 "cr_retail_limit.outlet_name",
//                 "cr_retail_limit.owner_name",
//                 "cr_retail_limit.phone",
//                 "cr_retail_limit.address",
//                 "cr_interest_settings.interest_percentage AS interest_rate",
//                 "cr_interest_settings.service_charge_percentage AS service_charge",
//                 knex.raw(`sum(cr_credit_payments.paid_amount) as paid_amount`),
//                 knex.raw(`sum(cr_credit_payments.paid_principle) as paid_principle`),
//                 knex.raw(`sum(cr_credit_payments.paid_interest_amount) as paid_interest_amount`),
//                 knex.raw(`DATE_FORMAT(cr_credit_payments.sys_date , "%d %b %Y") AS sys_date`)
//             )
//             .leftJoin("distributorspoint", "distributorspoint.id", "cr_retail_limit.id_point")
//             .leftJoin("company", "distributorspoint.dsid", "company.id")
//             .leftJoin("cr_credit_payments", "cr_credit_payments.id_outlet", "cr_retail_limit.id_outlet")
//             .innerJoin("cr_interest_settings", "cr_retail_limit.outlet_code", "cr_interest_settings.outlet_code")
//             .where(function () {
//                 this.whereIn("cr_retail_limit.id_point", dpids);
//                 this.whereBetween('cr_credit_payments.sys_date', [fromDate, toDate]);
//                 if (filterText) {
//                     var search_param = filterText.toLowerCase().replace(/\s/g, '');
//                     this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
//                 }
//             })
//             // .where("cr_retail_limit.kyc_status", "Initial")
//             .where("cr_retail_limit.activation_status", "Active")
//             .groupBy("cr_credit_payments.id")
//             .orderBy("cr_retail_limit.id_outlet", "cr_credit_disbursements.sys_date");


//             // res.send(sendApiResult(true, "File Generated", data));

//         const header = [
//             { header: 'SN', key: 'sn', width: 10},
//             { header: 'House', key: 'dh_name', width: 36},
//             { header: 'Point', key: 'dp_name', width: 16},
//             { header: 'Outlet Code', key: 'outlet_code', width: 13},
//             { header: 'Outlet Name', key: 'outlet_name', width: 33},
//             { header: 'Owner Name', key: 'owner_name', width: 27},
//             { header: 'Phone', key: 'phone', width: 17},
//             { header: 'Address', key: 'address', width: 34},
//             { header: 'Interest Rate', key: 'interest_rate', width: 12},
//             { header: 'Service Charge', key: 'service_charge', width: 13},
//             { header: 'Paid Amount', key: 'paid_amount', width: 12},
//             { header: 'Paid Principle Amount', key: 'paid_principle', width:20 },
//             { header: 'Paid Interest Amount', key: 'paid_interest_amount', width:19 },
//             { header: 'Date', key: 'sys_date', width:10 }
//         ];


//         let chunkData = sliceIntoChunks(data,1000000);
//         // let chunkData = sliceIntoChunks(data,500000);
//         let fileName = [];
//         let singelFileName;
//         let prefixFileName = 'payments_day_wise_report/Payments_Day_Wise';

//         chunkData.forEach(async function(val,key){
//             index = key+1;
//             if(chunkData.length == 1){
//                 singelFileName = `public/${prefixFileName}_(${fromDate} - ${toDate}).xlsx`;
//                 downloadFileName = `download/${prefixFileName}_(${fromDate} - ${toDate}).xlsx`;
//             }
//             else{
//                 singelFileName = `public/${prefixFileName}_${index}_(${fromDate} - ${toDate}).xlsx`;
//                 downloadFileName = `download/${prefixFileName}_${index}_(${fromDate} - ${toDate}).xlsx`;
//             }
//             let options = {
//                 'addSerialNumber' : true,  
//             };

//            await createExcle(header,singelFileName,val,options);
//            fileName.push(downloadFileName);
//         });
//         // console.log('fileName', fileName)
//         await timeout(fileName.length * 4000);
//         res.send(sendApiResult(true, "File Generated", fileName));
//     } catch (error) {
//         res.send(sendApiResult(false, error.message));
//     }
// }


exports.paymentsDownload = async (req, res) => {
    var url = require('url');
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var dpids = req.body.dpids;
    var fromDate = req.body.dateFrom ? req.body.dateFrom : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
    var toDate = req.body.dateTo ? req.body.dateTo : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
    var filterText = req.body.filterText;
    try {
        let data = await knex("cr_retail_limit")
            .select(
                // "cr_retail_limit.id",
                knex.raw("company.name as dh_name"),
                knex.raw("distributorspoint.name as dp_name"),
                "cr_retail_limit.outlet_code",
                "cr_retail_limit.outlet_name",
                "cr_retail_limit.owner_name",
                "cr_retail_limit.phone",
                "cr_retail_limit.address",
                "cr_interest_settings.interest_percentage AS interest_rate",
                "cr_interest_settings.service_charge_percentage AS service_charge",
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
            .innerJoin("cr_interest_settings", "cr_retail_limit.outlet_code", "cr_interest_settings.outlet_code")
            .where(function () {
                this.whereIn("cr_retail_limit.id_point", dpids);
                this.whereBetween('cr_credit_payments.sys_date', [fromDate, toDate]);
                if (filterText) {
                    var search_param = filterText.toLowerCase().replace(/\s/g, '');
                    this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                }
            })
            .where("cr_retail_limit.activation_status", "Active")
            .groupBy("cr_credit_payments.id")
            .orderBy("cr_retail_limit.id_outlet", "cr_credit_disbursements.sys_date");
        const header = [
            { header: 'SN', key: 'sn', width: 10 },
            { header: 'House', key: 'dh_name', width: 36 },
            { header: 'Point', key: 'dp_name', width: 16 },
            { header: 'Outlet Code', key: 'outlet_code', width: 13 },
            { header: 'Outlet Name', key: 'outlet_name', width: 33 },
            { header: 'Owner Name', key: 'owner_name', width: 27 },
            { header: 'Phone', key: 'phone', width: 17 },
            { header: 'Address', key: 'address', width: 34 },
            { header: 'Interest Rate', key: 'interest_rate', width: 12 },
            { header: 'Service Charge', key: 'service_charge', width: 13 },
            { header: 'Paid Amount', key: 'paid_amount', width: 12 },
            { header: 'Paid Principle Amount', key: 'paid_principle', width: 20 },
            { header: 'Paid Interest Amount', key: 'paid_interest_amount', width: 19 },
            { header: 'Date', key: 'sys_date', width: 10 }
        ];


        let chunkData = sliceIntoChunks(data, 1000000);
        // let chunkData = sliceIntoChunks(data,500000);
        let fileName = [];
        let singelFileName;
        let prefixFileName = 'payments_day_wise_report/Payments_Day_Wise';

        chunkData.forEach(async function (val, key) {
            index = key + 1;
            if (chunkData.length == 1) {
                singelFileName = `${process.env.PUBLIC_URL}${prefixFileName}_(${fromDate} - ${toDate}).xlsx`;
                downloadFileName = `${prefixFileName}_(${fromDate} - ${toDate}).xlsx`;
            }
            else {
                singelFileName = `${process.env.PUBLIC_URL}${prefixFileName}_${index}_(${fromDate} - ${toDate}).xlsx`;
                downloadFileName = `${prefixFileName}_${index}_(${fromDate} - ${toDate}).xlsx`;
            }
            let options = {
                'addSerialNumber': true,
            };
            createExcle(header, singelFileName, val, options);
            const url = generateBlobDownloadURL(downloadFileName);
            fileName.push(url);
        });

        await timeout(fileName.length * 15000);
        res.send(sendApiResult(true, "File Generated", fileName));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.dateWiseDisbPayByRoute = async (req, res) => {
    try {
        const result = await ReportModel.dateWiseDisbPayByRoute(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.registrationInformation = async (req, res) => {
    try {
        const result = await ReportModel.registrationInformation(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.uploadDocSubmittedOutlets = async (req, res) => {
    const update = await importExcelData2DB(req.file.filename, req.body);
    res.status(200).send(update);
}

const importExcelData2DB = async function (filePath, req) {
    try {
        var resData = [];
        var workbook = xlsx.readFile(process.env.PUBLIC_URL + 'doc_submitted/' + filePath, { type: "array" });
        const sheetnames = Object.keys(workbook.Sheets);
        let i = sheetnames.length;
        while (i--) {
            const sheetname = sheetnames[i];
            arrayName = sheetname.toString();
            resData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetname]);
            var insert = await ReportModel.updateDocSubmitted(resData, filePath, req);
        }
        return insert;
    } catch (error) {
        return sendApiResult(false, 'File not uploaded');
    }
}

exports.creditInformation = async (req, res) => {
    try {
        const result = await ReportModel.creditInformation(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.creditInformationByOutlet = async (req, res) => {
    try {
        const result = await ReportModel.creditInformationByOutlet(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getBadDebtsOutlets = async (req, res) => {
    try {
        const result = await ReportModel.getBadDebtsOutlets(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}


exports.checkIfAnyBlcokDue = async (req, res) => {
    try {
        var result = await ReportModel.checkIfAnyBlcokDue(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getKycFiApprovedDownload = async (req, res) => {
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
                                DATE_FORMAT(cr_credit_disbursements.sys_date, "%d %b %Y") as due_taken_date,
                                retail.total_due AS old_due_amount,
                                retail.minimum_due AS due_amount,
								DATE_FORMAT(CURDATE(), "%d %b %Y") as today,
								DATEDIFF(CURDATE(), cr_credit_disbursements.sys_date) as date_diff`))
            .from("distributorspoint")
            //retailer.cluster_name AS cluster_name,
            //route.number as route,
            //section_day.slug AS section,
            .innerJoin("company", "distributorspoint.dsid", "company.id")
            .innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
            .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
            .innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
            .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
            //.innerJoin({ retailer: "retailers" }, "retailer.dpid", "distributorspoint.id")
            //.innerJoin({ route: "routes"}, "route.id", "retailer.rtid")
            //.innerJoin({ section_day: "section_days"}, "section_day.section", "route.section")
            .innerJoin("cr_credit_disbursements", "cr_credit_disbursements.id_outlet", "retail.id_outlet")
            .innerJoin("cr_disbursement_wise_interest", "cr_credit_disbursements.id", "cr_disbursement_wise_interest.id_cr_credit_disbursement")
            .andWhere("distributorspoint.stts", 1)
            .where("cr_disbursement_wise_interest.is_penalty_interest", 1)
            .whereNot("cr_credit_disbursements.due_amount", 0)
            // .where("retail.total_due >", 0)
            .whereIn("distributorspoint.id", req.body['dpids'])
            //.whereNotIn("distributorspoint.id", [334, 338, 339, 339, 340]) //344 needs to be added
            // .whereNotIn("distributorspoint.id", [334, 344])
            //.where("retailer.stts", 1)
            .where("retail.kyc_status", "Approved")
            .orderBy("retail.id", "asc")
            .groupBy("retail.outlet_code");
        //console.log(data);


        const dataForRouteSectionDays = await knex("retailers")
            // .select(knex.raw(`retailers.id,retailers.dpid,CONCAT( routes.number, section_days.slug ) section,(CASE WHEN LENGTH( clusters.name )< 3 AND clusters.name <> CONCAT( routes.number, section_days.slug ) THEN 'Not Defined' ELSE clusters.name END) AS Cluster`))
            .select(knex.raw(`routes.number as route_number,retailers.retailer_code,CONCAT( routes.number, section_days.slug ) section,(CASE WHEN LENGTH( clusters.name )< 3 AND clusters.name <> CONCAT( routes.number, section_days.slug ) THEN 'Not Defined' ELSE clusters.name END) AS cluster`))
            //.innerJoin("cr_retail_limit", "cr_retail_limit.outlet_code", "retailers.retailer_code")
            .innerJoin("routes", "retailers.rtid", "routes.id")
            .innerJoin("section_days", "section_days.section", "routes.section")
            .leftJoin("clusters", "retailers.cname", "clusters.id")
            .where("retailers.stts", 1)
            .whereIn("retailers.dpid", req.body['dpids']);
        // .whereIn("cr_retail_limit.id_point",req.body['dpids']).toSQL().toNative();


        let arraydataForRouteSectionDays = {};
        dataForRouteSectionDays.map(row => {
            retailerCode = row.retailer_code;
            delete row.retailer_code;
            return arraydataForRouteSectionDays[retailerCode] = row;
        });

        data.map(row => {
            if (arraydataForRouteSectionDays.hasOwnProperty(row.outlet_code)) {
                row.section = arraydataForRouteSectionDays[row.outlet_code].section;
                row.cluster = arraydataForRouteSectionDays[row.outlet_code].cluster;
                row.route = arraydataForRouteSectionDays[row.outlet_code].route_number;
            } else {
                row.section = '';
                row.cluster = '';
                row.route = '';
            }
        });
        //res.send(sendApiResult(true, "File Generated", {data:data,arraydataForRouteSectionDays:arraydataForRouteSectionDays}));
        let header = {};
        if(req.body.user_type == 'fi'){
             header = {
                'region': 'Region',
                'area': 'Area',
                'house': 'House',
                'territory': 'Territory',
                'point': 'Point',
                // 'route': 'Route',
                // 'section': 'Route/Section',
                'cluster': 'Cluster',
                'outlet_code': 'Outlet Code',
                'outlet_name': 'Outlet Name',
                'owner_name': 'Owner Name',
                'phone': 'Phone',
                'address': 'Address',
                'old_due_amount': 'Due Amount',
                'due_taken_date': 'Last Due Taken Date',
                'today': 'Today',
                'date_diff': 'Number Of Days'

            }
        }
        else{
             header = {
                'region': 'Region',
                'area': 'Area',
                'house': 'House',
                'territory': 'Territory',
                'point': 'Point',
                // 'route': 'Route',
                'section': 'Route/Section',
                'cluster': 'Cluster',
                'outlet_code': 'Outlet Code',
                'outlet_name': 'Outlet Name',
                'owner_name': 'Owner Name',
                'phone': 'Phone',
                'address': 'Address',
                'old_due_amount': 'Due Amount',
                'due_taken_date': 'Last Due Taken Date',
                'today': 'Today',
                'date_diff': 'Number Of Days'

            }
        }
        const fileName = generaeteExcel(header, data, 'Bad_Debts_Outlets', ['old_due_amount', 'date_diff']);
        await timeout(1500);
        const url = generateBlobDownloadURL(fileName);
        res.send(sendApiResult(true, "File Generated", url));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.paymentMadeByDhToFi = async (req, res) => {
    try {
        const result = await ReportModel.paymentMadeByDhToFi(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.paymentMadeByDhToFiDownload = async (req, res) => {
    var url = require('url');
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var dpids = req.body.dpids;
    var fromDate = req.body.fromDate ? req.body.fromDate : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
    var toDate = req.body.toDate ? req.body.toDate : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
    var filterText = req.body.filterText;
    try {
        const data = await knex({ cp: "cr_credit_payments" })
            .select(
                knex.raw('DATE_FORMAT(cp.sys_date, "%d %b %Y") sys_date'),
                knex.raw("IFNULL(sum( cp.paid_amount ),0) AS paid_amount"),
                knex.raw("IFNULL(sum( cp.paid_interest_amount ),0) AS interest_amount"),
                knex.raw("IFNULL(sum( cp.paid_principle ),0) AS principle_amount"),
                knex.raw("IFNULL(sum( cp.carry_amount ),0) AS carry_amount"),
                //knex.raw("sum( cd.credit_amount ) AS disbursed_amount"),
                knex.raw(`IFNULL((
                            SELECT sum( cd.credit_amount )
                            FROM cr_credit_disbursements cd
                            WHERE cd.sys_date = cp.sys_date
                            AND cd.sys_date BETWEEN '${fromDate}' AND '${toDate}'
                        ),0) as disbursed_amount`)
            )
            .innerJoin({ cph: "cr_credit_payment_histories" }, function () {
                this.on("cph.id_outlet", "=", "cp.id_outlet")
                    .on("cp.sys_date", "=", "cph.sys_date")
            })
            .leftJoin({ crl: "cr_retail_limit" }, "crl.id_outlet", "cp.id_outlet")
            .where(function () {
                if (dpids) {
                    this.whereIn("crl.id_point", dpids);
                }
                if (fromDate) {
                    this.where("cp.sys_date", '>=', fromDate);
                }
                if (toDate) {
                    this.where("cp.sys_date", '<=', toDate);
                }
            })
            .where("crl.activation_status", "Active")
            .groupBy("cp.sys_date")
            .orderBy("cp.sys_date", "desc");

        const header = {
            'sys_date': 'Date',
            'disbursed_amount': 'Total Disbursed Amount',
            'paid_amount': 'Total Paid Amount',
            'interest_amount': 'Total Interest Amount',
            'principle_amount': 'Total Principle Amount',
            'carry_amount': 'Total Carry Amount'
        }
        const numberCast = ["paid_amount", "interest_amount", "principle_amount", "disbursed_amount", "carry_amount"];
        const fileName = generaeteExcel(header, data, 'Payments_Made_By_Dh_To_Fi', numberCast);
        await timeout(1500);
        const url = generateBlobDownloadURL(fileName);
        res.send(sendApiResult(true, "File Generated", url));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.totalCreditMemoVsPayments = async (req, res) => {
    try {
        const result = await ReportModel.totalCreditMemoVsPayments(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.totalCreditMemoVsPaymentsDownload = async (req, res) => {
    var url = require('url');
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query;
    var dpids = req.body.dpids;
    var fromDate = req.body.fromDate ? req.body.fromDate : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
    var toDate = req.body.toDate ? req.body.toDate : moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD');
    var filterText = req.body.filterText;
    try {
        const data = await knex({ cd: "cr_credit_disbursements" })
            .select(
                "dh.name AS dh_name",
                "crl.outlet_code",
                "crl.outlet_name",
                knex.raw("count( cd.id_outlet ) AS total_credit_memo_transaction"),
                knex.raw(`( SELECT count( cp.id_outlet ) FROM cr_credit_payments cp INNER JOIN cr_retail_limit AS crl ON crl.id_outlet = cp.id_outlet WHERE crl.id_point IN (${dpids.join()}) AND cp.sys_date BETWEEN '${fromDate}' AND '${toDate}'AND cd.outlet_code = cp.outlet_code AND cp.paid_amount > 0 ) AS total_credit_payment`)
            )
            .innerJoin({ crl: "cr_retail_limit" }, "crl.outlet_code", "cd.outlet_code")
            .innerJoin({ dh: "company" }, "dh.id", "crl.id_dh")
            .where(function () {
                if (req.body.dpids) {
                    this.whereIn("crl.id_point", req.body.dpids);
                    // this.whereNotIn("crl.id_point", [334, 344]);
                }
                if (req.body.fromDate) {
                    this.where("cd.sys_date", '>=', req.body.fromDate);
                }
                if (req.body.toDate) {
                    this.where("cd.sys_date", '<=', req.body.toDate);
                }
            })
            .where("crl.activation_status", "Active")
            .groupBy("crl.outlet_code");

        const header = {
            'dh_name': 'House',
            'outlet_code': 'Outlet code',
            'outlet_name': 'Outlet name',
            'total_credit_memo_transaction': 'Total Credit Memo Transaction',
            'total_credit_payment': 'Total Credit Payment'
        }
        const numberCast = ["total_credit_memo_transaction", "total_credit_payment"];
        const fileName = generaeteExcel(header, data, 'Total_credit_memo_vs_payments', numberCast);
        await timeout(1500);
        const url = generateBlobDownloadURL(fileName);
        res.send(sendApiResult(true, "File Generated", url));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.outletWiseCreditInfo = async (req, res) => {
    try {
        const result = await ReportModel.outletWiseCreditInfo(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.outletWiseCreditInfoDownload = async (req, res) => {
    const dpids = await getFiBaseDpids(req.body.fi_id);
    try {
        const data = await knex("cr_retail_limit")
            .select(
                knex.raw("dh.name AS dh_name"),
                "cr_retail_limit.outlet_code",
                "cr_retail_limit.outlet_name",
                knex.raw("IFNULL(( SELECT sum( cr_credit_disbursements.credit_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet ),0) AS loan_taken"),
                knex.raw("IFNULL(( SELECT sum( cr_credit_disbursements.due_amount + cr_credit_disbursements.total_interest_amount - cr_credit_disbursements.total_paid_interest_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet ),0) AS due_amount"),
                knex.raw("IFNULL((SELECT sum( cr_credit_payments.paid_amount ) FROM cr_credit_payments WHERE  cr_retail_limit.id_outlet = cr_credit_payments.id_outlet),0) AS paid_amount"),
                knex.raw("IFNULL(( SELECT sum( cr_credit_disbursements.paid_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet ),0) AS paid_principle"),
                knex.raw("IFNULL(( SELECT sum( cr_credit_disbursements.total_paid_interest_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet ),0) AS paid_interest_amount"),
                knex.raw(`IFNULL((
                                        (SELECT  sum( cr_credit_payments.paid_amount ) FROM cr_credit_payments WHERE cr_retail_limit.id_outlet = cr_credit_payments.id_outlet) - ( SELECT sum( cr_credit_disbursements.paid_amount + cr_credit_disbursements.total_paid_interest_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet ) 
                                    ),0) AS carry_amount`
                )
            )
            //.leftJoin("cr_credit_payments", "cr_retail_limit.id_outlet", "cr_credit_payments.id_outlet")
            .leftJoin({ dh: "company" }, "dh.id", "cr_retail_limit.id_dh")

            .where(function () {
                if (dpids) {
                    this.whereIn("cr_retail_limit.id_point", dpids);
                }
                // this.whereNot("cr_retail_limit.id_dh", 57);
                this.where(knex.raw("( SELECT sum( cr_credit_disbursements.credit_amount ) FROM cr_credit_disbursements WHERE cr_credit_disbursements.id_outlet = cr_retail_limit.id_outlet )"), '>', 0);
            })
            .groupBy("cr_retail_limit.id_outlet")
            .orderBy("outlet_code", "asc");

        const header = {
            'dh_name': 'House',
            'outlet_code': 'Outlet Code',
            'outlet_name': 'Outlet Name',
            'loan_taken': 'Loan Taken',
            'due_amount': 'Due Amount',
            'paid_amount': 'Paid Amount',
            'paid_principle': 'Paid Principle',
            'paid_interest_amount': 'Paid Interest Amount',
            'carry_amount': 'Carry Amount'
        }
        const numberCast = ["loan_taken", "due_amount", "paid_amount", "paid_principle", "paid_interest_amount", "carry_amount"];
        const fileName = generaeteExcel(header, data, 'Outlet_Wise_Credit_Info_' + moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD__hh_mm'), numberCast);
        await timeout(1500);
        const url = generateBlobDownloadURL(fileName);
        res.send(sendApiResult(true, "File Generated", url));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.repaymentDayReport = async (req, res) => {
    try {
        const result = await ReportModel.repaymentDayReport(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.repaymentDayReportDownload = async (req, res) => {
    const dpids = await getFiBaseDpids(req.body.fi_id);
    try {
        const data = await knex("cr_retail_limit")
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
            .leftJoin({ dh: "company" }, "dh.id", "cr_retail_limit.id_dh")
            .leftJoin("distributorspoint", "cr_retail_limit.id_point", "distributorspoint.id")
            .innerJoin("cr_credit_disbursements", "cr_retail_limit.id_outlet", "cr_credit_disbursements.id_outlet")
            .where(function () {
                if (dpids) {
                    this.whereIn("cr_retail_limit.id_point", dpids);
                }
                // this.whereNot("cr_retail_limit.id_dh", 57);
            })
            .orderBy("cr_retail_limit.id_outlet", "asc")

        // const header = {
        //     "house": "House",
        //     "point": "Point",
        //     "outlet_code": "Outlet Code",
        //     "outlet_name": "Outlet Name",
        //     "owner_name": "Owner Name",
        //     "phone": "Phone",
        //     "address": "Address",
        //     "credit_amount": "Credit Amount",
        //     "no_of_days_taken_to_repay": "No of days taken to repay/ No of days since loan taken",
        //     "due_amount": "Due Amount",
        //     "credit_disbursements_date": "Credit Disbursements Date"
        // }
        // const numberCast = ["credit_amount", "no_of_days_taken_to_repay", "due_amount"];
        // const fileName = generaeteExcel(header, data, 'Repayment_day_report' + moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD__hh_mm'), numberCast);
        // await timeout(1500);

        const header = [
            { header: 'House', key: 'dh_name', width: 36 },
            { header: 'Point', key: 'dh_name', width: 16 },
            { header: 'Outlet Code', key: 'outlet_code', width: 13 },
            { header: 'Outlet Name', key: 'outlet_name', width: 33 },
            { header: 'Owner Name', key: 'owner_name', width: 27 },
            { header: 'Phone', key: 'phone', width: 17 },
            { header: 'Address', key: 'address', width: 34 },
            { header: 'Credit Amount', key: 'credit_amount', width: 12 },
            { header: 'No of days taken to repay/ No of days since loan taken', key: 'no_of_days_taken_to_repay', width: 33 },
            { header: 'Due Amount', key: 'due_amount', width: 12 },
            { header: 'Credit Disbursements Date', key: 'credit_disbursements_date', width: 20 },
        ];

        fileName = `generatedExcelFromDT/Repayment_day_report_${moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD__hh_mm')}.xlsx`;

        createExcle(header, process.env.PUBLIC_URL + "" + fileName, data);
        await timeout(1500);
        const url = generateBlobDownloadURL(fileName);
        res.send(sendApiResult(true, "File Generated", url));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.outstandingReportDownload = async (req, res) => {
    try {
        const result = await ReportModel.outstandingReportDownload(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.registrationLiveUpdate = async (req, res) => {
    try {
        const result = await ReportModel.registrationLiveUpdate();
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.downloadCustomerReport = async (req, res) => {
    try {
        const result = await ReportModel.downloadCustomerReport(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

// Develop by moin
exports.getNidMasterData = async (req, res) => {
    try {
        const dpids = req.body.dpids;
        let data = await await knex("cr_retail_limit")
            .select(
                knex.raw("nid_master_data_v2.*"),
                "cr_retail_limit.phone"
            )
            .innerJoin("nid_master_data_v2", "nid_master_data_v2.outlet_code", "cr_retail_limit.outlet_code")
            .whereIn("cr_retail_limit.id_point", dpids)
            .where('nid_master_data_v2.show_status', 1)
            .where("cr_retail_limit.activation_status", "Active")
            .where("cr_retail_limit.kyc_status", "Pending");
        let finalData = [];
        data.map(row => {

            let objOfData = {};
            objOfData.title_1 = '';
            objOfData.subject_role = '';
            objOfData.type_of_financing = '';
            objOfData.number_Of_installment = '';
            objOfData.installment_amount = '';
            objOfData.total_requested_amount = '';
            objOfData.periodicity_of_payment = '';
            objOfData.title_2 = '';
            objOfData.name = row.fullNameEN;
            objOfData.father_title = '';
            objOfData.father_name = row.fathersNameEN;
            objOfData.mother_title = '';
            objOfData.mother_name = row.mothersNameEN;
            objOfData.spouse_title = '';
            objOfData.spouse_name = row.spouseNameEN;
            objOfData.nid = row.nid;
            objOfData.tin = '';
            objOfData.dob = row.dob;
            objOfData.gender = row.gender;
            objOfData.district_of_birth = '';
            objOfData.country_of_birth = 'Bangladesh';
            objOfData.permanent_district = '';
            objOfData.permanent_street_name_and_number = row.permenantAddressEN;
            objOfData.permanent_postal_code = '';
            const permenantAddressEN = getPostCode(row.permenantAddressEN);
            objOfData.permanent_postal_code = permenantAddressEN;
            objOfData.permanent_country = 'Bangladesh';
            objOfData.present_district = '';
            objOfData.present_street_name_and_number = row.presentAddressEN;
            objOfData.present_postal_code = '';
            const presentAddressEN = getPostCode(row.presentAddressEN);
            objOfData.present_postal_code = presentAddressEN;
            objOfData.present_district = '';
            objOfData.present_country = 'Bangladesh';
            objOfData.id_type = '';
            objOfData.id_number = '';
            objOfData.id_issue_date = '';
            objOfData.id_issue_country = '';
            objOfData.sector_type = '';
            objOfData.sector_code = '';
            objOfData.telephone_number = '';
            objOfData.data_source = '';
            objOfData.ref_no = row.outlet_code;
            objOfData.applicant_type = '';
            objOfData.remarks = '';
            objOfData.ekyc_result_id = '';
            objOfData.tracking_no = '';
            objOfData.mobile_no = row.phone;
            objOfData.full_name_bn = row.fullNameBN;
            objOfData.mother_name_bn = row.mothersNameBN;
            objOfData.father_name_bn = row.fathersNameBN;
            objOfData.permanent_address_bn = row.permanentAddressBN;
            objOfData.face_match_scorerpa = '';
            objOfData.make_by = '';
            objOfData.make_date = '';
            objOfData.is_verified = '';

            finalData.push(objOfData);
        });

        // console.log(finalData);
        let header = [
            { header: 'Title', key: 'title_1', width: 5 },
            { header: 'Subject Role', key: 'subject_role', width: 16 },
            { header: 'Type Of Financing', key: 'type_of_financing', width: 20 },
            { header: 'Number Of Installment', key: 'number_Of_installment', width: 26 },
            { header: 'Installment Amount', key: 'installment_amount', width: 27 },
            { header: 'Total Requested Amount', key: 'total_requested_amount', width: 22 },
            { header: 'periodicity Of Payment', key: 'periodicity_of_payment', width: 26 },
            { header: 'Title', key: 'title_2', width: 6 },
            { header: 'Name', key: 'name', width: 37 },
            { header: 'Father Title', key: 'father_title', width: 14 },
            { header: 'Father Name', key: 'father_name', width: 46 },
            { header: 'Mother Title', key: 'mother_title', width: 14 },
            { header: 'Mother Name', key: 'mother_name', width: 46 },
            { header: 'Spouse Title', key: 'spouse_title', width: 14 },
            { header: 'Spouse Name', key: 'spouse_name', width: 46 },
            { header: 'NID', key: 'nid', width: 17 },
            { header: 'TIN', key: 'tin', width: 4 },
            { header: 'Date Of Birth', key: '', width: 16 },
            { header: 'Gender', key: '', width: 9 },
            { header: 'District Of Birth', key: 'district_of_birth', width: 19 },
            { header: 'Country Of Birth', key: 'country_of_birth', width: 20 },
            { header: 'Permanent District', key: 'permanent_district', width: 22 },
            { header: 'Permanent Street Name And Number', key: 'permanent_street_name_and_number', width: 155 },
            { header: 'Permanent Postal Code', key: 'permanent_postal_code', width: 20 },
            { header: 'Permanent Country', key: 'permanent_country', width: 22 },
            { header: 'Present District', key: 'present_district', width: 19 },
            { header: 'Present Street Name And Number', key: 'present_street_name_and_number', width: 158 },
            { header: 'Present Postal Code', key: 'present_postal_code', width: 20 },
            { header: 'Present Country', key: 'present_country', width: 20 },
            { header: 'Id Type', key: 'id_type', width: 8 },
            { header: 'Id Number', key: 'id_number', width: 11 },
            { header: 'Id Issue Date', key: 'id_issue_date', width: 15 },
            { header: 'Id Issue Country', key: 'id_issue_country', width: 19 },
            { header: 'Sector Type', key: 'sector_type', width: 14 },
            { header: 'Sector Code', key: 'sector_code', width: 14 },
            { header: 'Telephone Number', key: 'telephone_number', width: 21 },
            { header: 'Data Source', key: 'data_source', width: 15 },
            { header: 'Ref No', key: 'ref_no', width: 12 },
            { header: 'Applicant Type', key: 'applicant_type', width: 17 },
            { header: 'Remarks', key: 'remarks', width: 10 },
            { header: 'Ekyc Result Id', key: 'ekyc_result_id', width: 15 },
            { header: 'Tracking No', key: 'tracking_no', width: 13 },
            { header: 'Mobile No', key: 'mobile_no', width: 16 },
            { header: 'Full Name BN', key: 'full_name_bn', width: 34 },
            { header: 'Mother Name BN', key: 'mother_name_bn', width: 34 },
            { header: 'Father Name BN', key: 'father_name_bn', width: 34 },
            { header: 'Permanent Address BN', key: 'permanent_address_bn', width: 140 },
            { header: 'Face Match Scorerpa', key: 'face_match_scorerpa', width: 23 },
            { header: 'Make By', key: 'make_by', width: 13 },
            { header: 'Make Date', key: 'make_date', width: 11 },
            { header: 'Is verified', key: 'is_verified', width: 11 }

        ];

        fileName = `ekyc_report/Ekyc_${moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD__hh_mm')}.xlsx`;

        createExcle(header, process.env.PUBLIC_URL + "" + fileName, finalData);
        await timeout(1500);
        const url = generateBlobDownloadURL(fileName);
        res.send(sendApiResult(true, "File Generated", url));


    }
    catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getNidMasterDataReport = async (req, res) => {
    try {
        const outlets = await ReportModel.nidMasterDataReport(req);
        res.status(200).send(outlets);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}
