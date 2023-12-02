const knex = require('../config/database')
const { sendApiResult } = require('../controllers/helperController');
var moment = require('moment');
const fs = require("fs");
var pdfMake = require('../../node_modules/pdfmake/build/pdfmake');
var vfsFonts = require('../../node_modules/pdfmake/build/vfs_fonts');
pdfMake.vfs = vfsFonts.pdfMake.vfs;

let Billing = function () { }

Billing.getDhBillingInfo = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
				
			const dh_info = await knex("distributorspoint").select("distributorspoint.dsid AS dh_id", "company.name AS dh_name").innerJoin("company", "company.id", "distributorspoint.dsid").where("distributorspoint.stts", 1).whereIn("distributorspoint.id", req.dpids).whereNotIn("distributorspoint.id", [334, 344]).first();
			const fi_info = await knex("cr_dh_fi").select("cr_dh_fi.id_fi", "cr_fi_institute.name AS fi_name").innerJoin("cr_fi_institute", "cr_fi_institute.id", "cr_dh_fi.id_fi ").where("cr_dh_fi.id_dh", dh_info.dh_id).first();
					
			const dhServiceChargeInfo = await calculateDhServiceChargeByDate(req.from_date, req.to_date, req.dpids);			
			
			if(dhServiceChargeInfo.length != 0){
				var total_payments_amount_to_fi_in_words = await amount_in_words(dhServiceChargeInfo.total_payment_amount_to_fi);						
				// var total_service_charge_amount_in_words = await amount_in_words(dhServiceChargeInfo.total_service_charge_amount);						
				var fi_service_charge_amount_in_words = await amount_in_words(dhServiceChargeInfo.fi_service_charge_amount);			
				var dh_service_charge_amount_in_words = await amount_in_words(dhServiceChargeInfo.dh_service_charge_amount);
				
				var today =  moment(new Date()).format('YYYY-MM-DD');
				const dhServiceChargeByDate = {
					'dh_name' : dh_info.dh_name,
					'fi_name' : fi_info.fi_name,
					'sys_date' : await dayNameWithMonth(today),
					'from_date' : await dayNameWithMonth(req.from_date),
					'to_date' : await dayNameWithMonth(req.to_date),
					'total_payment_to_fi' : dhServiceChargeInfo.total_payment_amount_to_fi,
					// 'total_payment_to_fi_words' : total_payments_amount_to_fi_in_words.trim(),
					'total_service_charge' : dhServiceChargeInfo.total_service_charge_amount,
					// 'total_service_charge_words' : total_service_charge_amount_in_words.trim(),
					// 'fi_service_charge' : dhServiceChargeInfo.fi_service_charge_amount,
					// 'fi_service_charge_words' : fi_service_charge_amount_in_words.trim(),
					'dh_service_charge' : dhServiceChargeInfo.dh_service_charge_amount,
					'dh_service_charge_words' : dh_service_charge_amount_in_words.trim(),
				}
				resolve(sendApiResult(true, "Billing Info Fetched Successfully", dhServiceChargeByDate));
				
			} else {
				resolve(sendApiResult(true, "No Data Found"));
			}
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Billing.submittedDhBillingInfo = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const submitted_billing_data = await knex("cr_billing_info")
											.select(
												"cr_billing_info.id AS billing_id",
												"cr_billing_info.invoice_no AS invoice_no",
												"company.name AS dh_name",
												"cr_fi_institute.name AS fi_name",
												"cr_users.name AS created_by",
												knex.raw(`DATE_FORMAT(cr_billing_info.from_date, "%d %b %Y") AS from_date`),
												knex.raw(`DATE_FORMAT(cr_billing_info.to_date, "%d %b %Y") AS to_date`),
												knex.raw(`DATE_FORMAT(cr_billing_info.bill_submit_date, "%d %b %Y") AS bill_submit_date`),
												"cr_billing_info.total_payment_to_fi AS total_payment_to_fi",
												"cr_billing_info.total_principal_amount AS total_principal_amount",
												"cr_billing_info.total_interest_amount AS total_interest_amount",
												"cr_billing_info.total_service_charge_amount AS total_service_charge_amount",
												"cr_billing_info.total_penalty_amount AS total_penalty_amount",
												"cr_billing_info.fi_service_charge AS fi_service_charge",
												"cr_billing_info.dh_service_charge AS dh_service_charge",
												"cr_billing_info.claim_status AS claim_status"
											)
											.innerJoin("cr_users", "cr_users.id", "cr_billing_info.created_by")
											.innerJoin("cr_fi_institute", "cr_fi_institute.id", "cr_billing_info.id_fi")
											.innerJoin("company", "company.id", "cr_billing_info.dh_id")
											.innerJoin("distributorspoint", "distributorspoint.dsid", "company.id")
											.where(function() {
												this.whereBetween('cr_billing_info.from_date', [req.from_date, req.to_date]);
												this.orWhereBetween('cr_billing_info.to_date', [req.from_date, req.to_date]);
											})
											.whereIn("distributorspoint.id", req.dpids)
											.whereNotIn("distributorspoint.id", [334, 344])
											.orderBy("cr_billing_info.id", "DESC")
											.groupBy("company.id", "cr_fi_institute.id", "cr_billing_info.from_date");
			
			if(submitted_billing_data.length > 0){
				var msg = "DH Submitted Billing Data Fetched Successfully";
			} else {
				var msg = "No Data Found in " + await dayNameWithMonth(req.from_date) + " to " +await dayNameWithMonth(req.to_date);
			}
			resolve(sendApiResult(true, msg, submitted_billing_data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Billing.downloadDhBillingInfo = function (req) {
    return new Promise(async (resolve, reject) => {
		try {
			const dh_info = await knex("distributorspoint").select("distributorspoint.dsid AS dh_id", "company.name AS dh_name").innerJoin("company", "company.id", "distributorspoint.dsid").where("distributorspoint.stts", 1).whereIn("distributorspoint.id", req.dpids).whereNotIn("distributorspoint.id", [334, 344]).first();
			const fi_info = await knex("cr_dh_fi").select("cr_dh_fi.id_fi", "cr_fi_institute.name AS fi_name").innerJoin("cr_fi_institute", "cr_fi_institute.id", "cr_dh_fi.id_fi ").where("cr_dh_fi.id_dh", dh_info.dh_id).first();
			
			const dhServiceChargeInfo = await calculateDhServiceChargeByDate(req.from_date, req.to_date, req.dpids);
			var dh_service_charge_amount_in_words = await amount_in_words(dhServiceChargeInfo.dh_service_charge_amount);
			
			var today =  moment(new Date()).format('YYYY-MM-DD');
			
			const dhServiceChargeByDate = {
				'dh_name' : dh_info.dh_name,
				'fi_name' : fi_info.fi_name,
				'sys_date' : await dayNameWithMonth(today),
				'from_date' : await dayNameWithMonth(req.from_date),
				'to_date' : await dayNameWithMonth(req.to_date),
				'total_payment_to_fi' : dhServiceChargeInfo.total_payment_amount_to_fi,
				'total_service_charge' : dhServiceChargeInfo.total_service_charge_amount,
				'dh_service_charge' : dhServiceChargeInfo.dh_service_charge_amount,
				'dh_service_charge_words' : dh_service_charge_amount_in_words.trim(),
			}
			
			var file_name = dh_info.dh_name + " Invoice.pdf";
			var file_name = dhServiceChargeByDate.dh_name +" (" + dhServiceChargeByDate.from_date + " - " + dhServiceChargeByDate.to_date + ").pdf";
			const documentDefinition = await preparePdfInvoice (fi_info.fi_name, dhServiceChargeByDate);
			const pdfDoc = pdfMake.createPdf(documentDefinition);
			pdfDoc.getBase64((data) => {
				const file_details = {
					'file_name' : file_name,
					'blod_data' : data
				};
				resolve(sendApiResult(true, "Bill Download Successfully", file_details));
			});
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });	
}

Billing.submitDhBillingInfo = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            
			const dh_info = await knex("distributorspoint").select("distributorspoint.dsid AS dh_id", "company.name AS dh_name").innerJoin("company", "company.id", "distributorspoint.dsid").where("distributorspoint.stts", 1).whereIn("distributorspoint.id", req.dpids).whereNotIn("distributorspoint.id", [334, 344]).first();
			const fi_info = await knex("cr_dh_fi").select("cr_dh_fi.id_fi", "cr_fi_institute.name AS fi_name").innerJoin("cr_fi_institute", "cr_fi_institute.id", "cr_dh_fi.id_fi ").where("cr_dh_fi.id_dh", dh_info.dh_id).first();
			
			var today = new Date().getTime();
			var from_date = new Date(req.from_date).getTime();
			var to_date = new Date(req.to_date).getTime();
			
			if(today < from_date || today < to_date){				
				const date = new Date();
				date.setDate(new Date().getDate() - 1);
				var year = date.getFullYear();
				var month = ("0" + (date.getMonth() + 1)).slice(-2);
				var day = ("0" + date.getDate()).slice(-2);
				var max_date = year + '-' + month + '-' + day;
				var msg = dh_info.dh_name + " can't Generate Bill After " + await dayNameWithMonth(max_date) + ".";
				reject(sendApiResult(false, msg));
			}
			else {
				const billing_info = await checkBillingStatus(req.from_date, req.to_date, dh_info);
				
				if(billing_info.length > 0){
					const dh_billing_data = {
						'dh_name' : dh_info.dh_name,
						'fi_name' : fi_info.fi_name,
						'from_date' : await dayNameWithMonth(billing_info[0].from_date),
						'to_date' : await dayNameWithMonth(billing_info[0].to_date),
						'bill_submit_date' : await dayNameWithMonth(billing_info[0].bill_submit_date),
						'bill_status' : billing_info[0].bill_status,
						'created_by' : billing_info[0].created_by,
					}
					var msg = dh_info.dh_name + ' Bill Generated Already from ' + dh_billing_data.from_date + ' to ' + dh_billing_data.to_date;
					reject(sendApiResult(false, msg));
				} else {
					const dhServiceChargeInfo = await calculateDhServiceChargeByDate(req.from_date, req.to_date, req.dpids);
					var invoice_no = (dh_info.dh_name).split(' ');
					const exist_invoice_count = await existInvoiceCount(dh_info);
					invoice_no = invoice_no[0] + ' ' + await addingExtraZeros((exist_invoice_count.length+1),3);
					
					if(dhServiceChargeInfo.length != 0){
						const insertBillingInfo = {
							'dh_id' : dh_info.dh_id,
							'id_fi' : fi_info.id_fi,
							'invoice_no' : invoice_no,
							'bill_submit_date' : moment(new Date()).format('YYYY-MM-DD'),
							'from_date' : req.from_date,
							'to_date' : req.to_date,
							'total_payment_to_fi' : dhServiceChargeInfo.total_payment_amount_to_fi,
							'total_principal_amount' : dhServiceChargeInfo.total_principal_amount,
							'total_interest_amount' : dhServiceChargeInfo.total_interest_amount,
							'total_service_charge_amount' : dhServiceChargeInfo.total_service_charge_amount,
							'total_penalty_amount' : dhServiceChargeInfo.total_penalty_amount,
							'fi_service_charge' : dhServiceChargeInfo.fi_service_charge_amount,
							'dh_service_charge' : dhServiceChargeInfo.dh_service_charge_amount,
							'claim_status' : 'Requested',
							'created_by' : req.created_by,					
						}
						
						const cr_bill_insert = await knex("cr_billing_info").insert(insertBillingInfo).returning('id');
						var billing_info_last_id = cr_bill_insert[0];
						
						var cr_billing_details = [];
						for (const [key, value] of Object.entries(dhServiceChargeInfo.dp_ids)){					
							var temp_data = {};
							temp_data.billing_info_id = billing_info_last_id;
							temp_data.dp_id = value;
							temp_data.from_date = req.from_date;
							temp_data.to_date = req.to_date;
							temp_data.created_by = req.created_by;					
							
							cr_billing_details.push(temp_data);
						}
						
						if(await knex("cr_billing_info_details").insert(cr_billing_details)){
							
							const payment_update = await knex("cr_credit_payments")
														.whereIn("id", dhServiceChargeInfo.payment_ids)
														.update({
															'bill_claim_status': 1,
															'bill_claim_id': billing_info_last_id
														});
													
							if(payment_update !=  0){
								var msg = dh_info.dh_name + " Bill Generated Successfully from " + await dayNameWithMonth(req.from_date) + " to " + await dayNameWithMonth(req.to_date);
								resolve(sendApiResult(true, msg));
							} else {
								reject(sendApiResult(false, error.message));
							}
						} else {
							reject(sendApiResult(false, error.message));
						}
					} else {
						var msg = "No Data Found in " + await dayNameWithMonth(req.from_date) + " to " +await dayNameWithMonth(req.to_date);
						resolve(sendApiResult(true, msg));
					}
				}
			}
			
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Billing.downloadDhBillingHistory = function (req) {
    return new Promise(async (resolve, reject) => {
		try {
			const billing_data = await knex("cr_billing_info")
								.select(
									"company.name AS dh_name",
									"cr_fi_institute.name AS fi_name",
									"cr_billing_info.invoice_no AS invoice_no",
									knex.raw(`DATE_FORMAT(cr_billing_info.from_date, "%d %b %Y") AS from_date`),
									knex.raw(`DATE_FORMAT(cr_billing_info.to_date, "%d %b %Y") AS to_date`),
									knex.raw(`DATE_FORMAT(cr_billing_info.bill_submit_date, "%d %b %Y") AS bill_submit_date`),
									"cr_billing_info.total_payment_to_fi",
									"cr_billing_info.dh_service_charge",
									"cr_billing_info.total_service_charge_amount"
								)
								.innerJoin("cr_fi_institute", "cr_fi_institute.id", "cr_billing_info.id_fi")
								.innerJoin("company", "company.id", "cr_billing_info.dh_id")								
								.where("cr_billing_info.id", req.billing_id)
								.first();
										
			var dh_service_charge_amount_in_words = await amount_in_words(billing_data.dh_service_charge);
						
			const dhServiceChargeByDate = {
				'dh_name' : billing_data.dh_name,
				'fi_name' : billing_data.fi_name,
				'invoice_no' : billing_data.invoice_no,
				'sys_date' : billing_data.bill_submit_date,
				'from_date' : billing_data.from_date,
				'to_date' : billing_data.to_date,
				'total_payment_to_fi' : billing_data.total_payment_to_fi,
				'total_service_charge' : billing_data.total_service_charge_amount,
				'dh_service_charge' : billing_data.dh_service_charge,
				'dh_service_charge_words' : dh_service_charge_amount_in_words.trim()
			}
									
			var file_name = dhServiceChargeByDate.dh_name +" [" + dhServiceChargeByDate.invoice_no + "] (" + dhServiceChargeByDate.from_date + " - " + dhServiceChargeByDate.to_date + ").pdf";
			const documentDefinition = await preparePdfInvoice (dhServiceChargeByDate.fi_name, dhServiceChargeByDate);
			
			const pdfDoc = pdfMake.createPdf(documentDefinition);
			pdfDoc.getBase64((data) => {
				const file_details = {
					'file_name' : file_name,
					'blod_data' : data
				};
				resolve(sendApiResult(true, "Bill Download Successfully", file_details));
			});
			
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });	
}

const checkBillingStatus = async function (from_date, to_date, dh_info) {
	return new Promise(async (resolve, reject) => {
        try {
			const billing_data = await knex("cr_billing_info")
								.select(
									knex.raw(`DATE_FORMAT(cr_billing_info.from_date, "%Y-%m-%d") AS from_date`),
									knex.raw(`DATE_FORMAT(cr_billing_info.to_date, "%Y-%m-%d") AS to_date`),
									knex.raw(`DATE_FORMAT(cr_billing_info.bill_submit_date, "%Y-%m-%d") AS bill_submit_date`),
									"cr_users.name AS created_by",
									"cr_billing_info.claim_status AS bill_status",
									"cr_fi_institute.name AS fi_name"
								)
								.innerJoin("cr_users", "cr_users.id", "cr_billing_info.created_by")
								.innerJoin("cr_fi_institute", "cr_fi_institute.id", "cr_billing_info.id_fi")
								.where(function() {
									this.whereBetween('cr_billing_info.from_date', [from_date, to_date]);
									this.orWhereBetween('cr_billing_info.to_date', [from_date, to_date]);
								})
								.where("dh_id", dh_info.dh_id);
								
			resolve(billing_data);
		} catch (error) {			
			reject(error.message)
		}
    })
}

const existInvoiceCount = async function (dh_info) {
	return new Promise(async (resolve, reject) => {
        try {
			const billing_data = await knex("cr_billing_info")
								.select(
									knex.raw(`DATE_FORMAT(cr_billing_info.from_date, "%Y-%m-%d") AS from_date`),
									knex.raw(`DATE_FORMAT(cr_billing_info.to_date, "%Y-%m-%d") AS to_date`),
									knex.raw(`DATE_FORMAT(cr_billing_info.bill_submit_date, "%Y-%m-%d") AS bill_submit_date`),
									"cr_users.name AS created_by",
									"cr_billing_info.claim_status AS bill_status",
									"cr_fi_institute.name AS fi_name"
								)
								.innerJoin("cr_users", "cr_users.id", "cr_billing_info.created_by")
								.innerJoin("cr_fi_institute", "cr_fi_institute.id", "cr_billing_info.id_fi")
								.where("dh_id", dh_info.dh_id);
								
			resolve(billing_data);
		} catch (error) {			
			reject(error.message)
		}
    })
}

const calculateDhServiceChargeByDate = async function (from_date, to_date, dpids) {	
	return new Promise(async (resolve, reject) => {
        try {
			const billing_data = await knex("cr_credit_payments")
										.select(
											'distributorspoint.dsid AS dh_id',
											'distributorspoint.id AS dp_id',
											'cr_credit_payments.id AS payment_id',
											'cr_credit_payments.paid_principle AS principal_amount',
											'cr_credit_payments.paid_interest_amount AS interest_amount',
											// 'cr_credit_payments.sys_interest_amount AS interest_amount',
											// 'cr_credit_payments.sys_service_charge_amount AS service_charge',
											// 'cr_credit_payments.sys_penalty_amount AS penalty_amount',
											'cr_credit_payments.service_charge_settings_id'
										)
										//.innerJoin("retailers", "retailers.id", "cr_credit_payments.id_outlet")
										.innerJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "cr_credit_payments.id_outlet")
										// .innerJoin("retailers", "retailers.retailer_code", "cr_credit_payments.outlet_code")										
										.innerJoin("distributorspoint", "distributorspoint.id", "cr_retail_limit.id_point")
										/*.where(
											{
												"retailers.stts": "1"
											}
										)*/
										 .whereIn("cr_retail_limit.id_point", dpids)
										//.whereIn("retailers.dpid", [414])
										.whereBetween('cr_credit_payments.sys_date', [from_date, to_date]);

			if(billing_data.length > 0){
				var dh_ids = [];
				var dp_ids = [];
				var payment_ids = [];
				var total_principal_amount = 0;
				var total_interest_amount = 0;
				// var total_service_charge_amount = 0;
				// var total_penalty_amount = 0;
				var fi_service_charge_amount = 0;
				var dh_service_charge_amount = 0;

				for (const [key, value] of Object.entries(billing_data)){					
					if(dh_ids.includes(value.dh_id) != true){
						dh_ids.push(value.dh_id);
					}
					if(dp_ids.includes(value.dp_id) != true){
						dp_ids.push(value.dp_id);
					}
					
					payment_ids.push(value.payment_id);
					
					total_principal_amount += value.principal_amount;
					total_interest_amount += value.interest_amount;
					// total_service_charge_amount += value.service_charge;
					// total_penalty_amount += value.penalty_amount;
					
			
					
					const service_charge_info = await knex("cr_service_charge_settings").select("fi_share_percentage", "bat_share_percentage").where("id_point", value.dp_id).where("cr_service_charge_settings.id", value.service_charge_settings_id).first();
					// fi_service_charge_amount += parseFloat((value.service_charge * service_charge_info.fi_share_percentage) / 100);
					// dh_service_charge_amount += parseFloat((value.service_charge * service_charge_info.bat_share_percentage) / 100);
					
					// AS BAT confirmed DH will get service charge from ((value.interest_amount + value.service_charge + value.penalty_amount))
					// fi_service_charge_amount += parseFloat(( (value.interest_amount + value.service_charge + value.penalty_amount) * service_charge_info.fi_share_percentage) / 100);
					// dh_service_charge_amount += parseFloat(( (value.interest_amount + value.service_charge + value.penalty_amount) * service_charge_info.bat_share_percentage) / 100);
					
					fi_service_charge_amount += parseFloat(( value.interest_amount * service_charge_info.fi_share_percentage) / 100);
					dh_service_charge_amount += parseFloat(( value.interest_amount * service_charge_info.bat_share_percentage) / 100);
					console.log('fi_service_charge_amount' + key);
					console.log(fi_service_charge_amount);
				}
				
				console.log('final fi_service_charge_amount');
				console.log(fi_service_charge_amount);
				
				
								
				// var total_payment_amount_to_fi = parseFloat(total_principal_amount + total_interest_amount + total_service_charge_amount + total_penalty_amount).toFixed(2);
				var total_payment_amount_to_fi = parseFloat(total_principal_amount + total_interest_amount).toFixed(2);				
				
				console.log('total_payment_amount_to_fi');
				console.log(total_payment_amount_to_fi);
				
				const get_dh_billing_info = {
					'dh_ids' : dh_ids,
					'dp_ids' : dp_ids,
					'from_date' : from_date,
					'to_date' : to_date,
					'payment_ids' : payment_ids,					
					'total_principal_amount' : parseFloat(total_principal_amount).toFixed(2),
					'total_interest_amount' : parseFloat(total_interest_amount).toFixed(2),
					// 'total_service_charge_amount' : parseFloat(total_service_charge_amount).toFixed(2),
					'total_service_charge_amount' : parseFloat(total_interest_amount).toFixed(2),
					// 'total_penalty_amount' : parseFloat(total_penalty_amount).toFixed(2),
					'total_payment_amount_to_fi' : total_payment_amount_to_fi,
					'fi_service_charge_amount' : parseFloat(fi_service_charge_amount).toFixed(2),
					'dh_service_charge_amount' : parseFloat(dh_service_charge_amount).toFixed(2),
				}
				
				console.log('get_dh_billing_info');
				console.log(get_dh_billing_info);
				
				resolve(get_dh_billing_info);
			} else {
				resolve([]);
			}
		} catch (error) {			
			reject(error.message)
		}
    })
}

const preparePdfInvoice = async function (fi_name, dhServiceChargeByDate){
	pdfMake.fonts = {		
		Roboto: {
			normal: 'Roboto-Regular.ttf', 
			bold: 'Roboto-Medium.ttf', 
			italics: 'Roboto-Italic.ttf', 
			bolditalics: 'Roboto-MediumItalic.ttf'
		},
		TimesRoman: { 
			normal: 'TimesRoman-Regular.ttf', 
			bold: 'TimesRoman-Bold.ttf', 
			italics: 'TimesRoman-Italic.tt'			
		},
		Calibri: {
			normal: 'Calibri-Regular.ttf', 
			bold: 'Calibri-Bold.ttf', 
			italics: 'Calibri-Italic.ttf'			
		}
	};

	var pdfDocument = {
		pageOrientation: 'portrait',
		pageSize: 'Letter',
		pageMargins:[ 55, 250, 55, 25 ],
		defaultStyle: {
			font: 'Roboto'
		},
		content: [
			{
				text: 'Bill Claiming From ' + fi_name + '\n\n\n',
				style: 'header',
				alignment: 'center',
				fontSize: 16,
			},
			{
				columns: [
					{
						text: ((dhServiceChargeByDate.invoice_no != undefined) ? 'Invoice Number:' : ''),
						alignment: 'left',
						lineHeight:"1.3",
						fontSize: 12
					},
					{
						text: ((dhServiceChargeByDate.invoice_no != undefined) ? dhServiceChargeByDate.invoice_no : ''),
						alignment: 'left',
						lineHeight:"1.3",
						fontSize: 12
					},
					{
						text: ''
					}
				]
			},
			{
				columns: [
					{
						text: 'Date:',
						alignment: 'left',
						lineHeight:"1.3",
						fontSize: 12
					},
					{
						text: dhServiceChargeByDate.sys_date,
						alignment: 'left',
						lineHeight:"1.3",
						fontSize: 12
					},
					{
						text: ''
					}
				]
			},
			{
				columns: [
					{
						text: 'Bill For:',
						alignment: 'left',
						lineHeight:"1.3",
						fontSize: 12
					},
					{
						text: dhServiceChargeByDate.from_date + " - " + dhServiceChargeByDate.to_date,
						alignment: 'left',
						lineHeight: "1.3",
						fontSize: 12
					},
					{
						text: ''
					}
				]
			},
			{
				columns: [
					{
						text: 'DH Name:',
						alignment: 'left',
						lineHeight:"1.3",
						fontSize: 12
					},
					{
						text: dhServiceChargeByDate.dh_name,
						alignment: 'left',
						lineHeight:"1.3",
						fontSize: 12
					},
					{
						text: '\n\n'
					}
				]
			},
			{
				style: 'tableExample',
				table: {
					widths: ['33%', '33%', '33%'],
					body: [
						[
							{text: 'Total payment to ' + fi_name, style: 'total_payment_title'},
							{text: 'Total Service Charge Payment', style: 'total_service_charge_title'},
							{text: 'DH Service Charge', style: 'dh_service_charge_title'}
						],
						[
							{text: await numberWithCommas(dhServiceChargeByDate.total_payment_to_fi), style: 'total_payment_text'},
							{text: await numberWithCommas(dhServiceChargeByDate.total_service_charge), style: 'total_service_charge_text'},
							{text: await numberWithCommas(dhServiceChargeByDate.dh_service_charge), style: 'dh_service_charge_text'}
						]
					]
				},
				layout: {
					hLineWidth: function (i, node) {
						return 1.1;
					},
					vLineWidth: function (i, node) {
						return 1.1;
					}
				}
			},
			{
				text: '\n',						
			},
			{
				style: 'tableExample',
				table: {
					widths: ['32.5%', '66.5%'],
					body: [
						[
							{text: 'Total Bill in BDT', style: 'amount_bdt_title', alignment: 'left'},
							{text: await numberWithCommas(dhServiceChargeByDate.dh_service_charge), style: 'amount_bdt_word_title'},
						],
						[
							{text: 'Total Bill in Words', style: 'amount_bdt_text', alignment: 'left'},
							{text: dhServiceChargeByDate.dh_service_charge_words, style: 'amount_bdt_word_text'},
						]
					]
				},
				layout: {
					hLineWidth: function (i, node) {
						return 1.1;
					},
					vLineWidth: function (i, node) {
						return 1.1;
					}
				}
			},
			{
				text: '\n\nThis is a system generated report, no signatures required',						
				footer: 12,
				alignment: 'left'
			},
		],
		styles: {
			total_payment_title: {
				fontSize: 12,
				alignment: 'center'
			},
			total_service_charge_title: {
				fontSize: 12,
				alignment: 'center'
			},
			dh_service_charge_title: {
				fontSize: 12,
				alignment: 'center'
			},
			total_payment_text: {
				fontSize: 12,
				alignment: 'right'
			},
			total_service_charge_text: {
				fontSize: 12,
				alignment: 'right'
			},
			dh_service_charge_text: {
				fontSize: 12,
				alignment: 'right'
			},
			amount_bdt_title: {
				fontSize: 12				
			},
			amount_bdt_text: {
				fontSize: 12
			},
			amount_bdt_word_title: {
				fontSize: 12,
				alignment: 'right'
			},
			amount_bdt_word_text: {
				fontSize: 12,
				alignment: 'left'
			}
		}
	};
	return pdfDocument;
}

const amount_in_words = async function (numericValue) {	
	numericValue = parseFloat(numericValue).toFixed(2);	
	var amount = numericValue.toString().split('.');
	var taka = amount[0];
	var paisa = amount[1];
	var full_amount_in_words = await convert(taka) +" Taka and"+ await convert(paisa)+" Paisa Only";
	return full_amount_in_words;
}

const convert = async function (numericValue) {
	var iWords = ['Zero', ' One', ' Two', ' Three', ' Four', ' Five', ' Six', ' Seven', ' Eight', ' Nine'];
	var ePlace = ['Ten', ' Eleven', ' Twelve', ' Thirteen', ' Fourteen', ' Fifteen', ' Sixteen', ' Seventeen', ' Eighteen', ' Nineteen'];
	var tensPlace = ['', ' Ten', ' Twenty', ' Thirty', ' Forty', ' Fifty', ' Sixty', ' Seventy', ' Eighty', ' Ninety'];
	var inWords = [];
	var numReversed, inWords, actnumber, i, j;
	inWords = [];	
	if(numericValue == "00" || numericValue =="0"){
		return 'Zero';
	}
	var obStr = numericValue.toString();	
	numReversed = obStr.split('');
	actnumber = numReversed.reverse();
	if (Number(numericValue) == 0) {
		return 'Zero';
	}
	var iWordsLength = numReversed.length;
	var finalWord = '';
	j = 0;
	for (i = 0; i < iWordsLength; i++) {
		switch (i) {
			case 0:
				if (actnumber[i] == '0' || actnumber[i + 1] == '1') {
					inWords[j] = '';
				} else {
					inWords[j] = iWords[actnumber[i]];
				}
				inWords[j] = inWords[j] + '';
				break;
			case 1:				
				if (actnumber[i] == 0) {
					inWords[j] = '';
				} else if (actnumber[i] == 1) {
					inWords[j] = ePlace[actnumber[i - 1]];
				} else {
					inWords[j] = tensPlace[actnumber[i]];
				}
				break;
			case 2:
				if (actnumber[i] == '0') {
					inWords[j] = '';
				} else if (actnumber[i - 1] !== '0' && actnumber[i - 2] !== '0') {
					inWords[j] = iWords[actnumber[i]] + ' Hundred';
				} else {
					inWords[j] = iWords[actnumber[i]] + ' Hundred';
				}
				break;
			case 3:
				if (actnumber[i] == '0' || actnumber[i + 1] == '1') {
					inWords[j] = '';
				} else {
					inWords[j] = iWords[actnumber[i]];
				}
				if (actnumber[i + 1] !== '0' || actnumber[i] > '0') {
					inWords[j] = inWords[j] + ' Thousand';
				}
				break;
			case 4:
				if (actnumber[i] == 0) {
					inWords[j] = '';
				} else if (actnumber[i] == 1) {
					inWords[j] = ePlace[actnumber[i - 1]];
				} else {
					inWords[j] = tensPlace[actnumber[i]];
				}
				break;
			case 5:
				if (actnumber[i] == '0' || actnumber[i + 1] == '1') {
					inWords[j] = '';
				} else {
					inWords[j] = iWords[actnumber[i]];
				}
				if (actnumber[i + 1] !== '0' || actnumber[i] > '0') {
					inWords[j] = inWords[j] + ' Lakh';
				}
				break;
			case 6:				
				if (actnumber[i] == 0) {
					inWords[j] = '';
				} else if (actnumber[i] == 1) {
					inWords[j] = ePlace[actnumber[i - 1]];
				} else {
					inWords[j] = tensPlace[actnumber[i]];
				}
				break;
			case 7:
				if (actnumber[i] == '0' || actnumber[i + 1] == '1') {
					inWords[j] = '';
				} else {
					inWords[j] = iWords[actnumber[i]];
				}
				inWords[j] = inWords[j] + ' Crore';
				break;
			case 8:				
				if (actnumber[i] == 0) {
					inWords[j] = '';
				} else if (actnumber[i] == 1) {
					inWords[j] = ePlace[actnumber[i - 1]];
				} else {
					inWords[j] = tensPlace[actnumber[i]];
				}
				break;
			default:
				break;
		}
		j++;
	}
	inWords.reverse();
	for (i = 0; i < inWords.length; i++) {
		finalWord += inWords[i];
	}
	return finalWord;
}

const dayNameWithMonth = async function (date) {
	var month_list = [' ', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	var date = date.split("-");
	var year = date[0];
	var month = parseInt(date[1]);
	var day = date[2];
	return day + ' ' + month_list[month] + ' ' + year;
}

const addingExtraZeros = async function (str, max) {	
  str = str.toString();  
  return str.length < max ? await addingExtraZeros("0" + str, max) : str;
}

const numberWithCommas = async function (num) {
	var parts = num.toString().split('.');	
    return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (parts[1] ? "." + parts[1] : "");
}

module.exports = Billing;