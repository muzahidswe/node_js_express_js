const CreditModel = require("../Models/CreditModel");
const {
	sendApiResult,
	OutletCreditInfo,
	generaeteExcel,
	generateBlobDownloadURL,
	OutletCreditDetails
} = require("./helperController");
const knex = require("../config/database");
const excel = require("excel4node");
const readXlsxFile = require('read-excel-file/node');

exports.limitConfirmedCredits = async (req, res) => {
	try {
		const limitConfirmedCredits =
			await CreditModel.getLimitConfirmedCredits(req, res);
		res.status(200).send(limitConfirmedCredits);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};


exports.reviewOldCreditLimit = async (req, res) => {
	const schema = {
		'Outlet Code': {
			// JSON object property name.
			prop: 'outletCode',
			type: String
		},
		'New credit limit': {
			prop: 'newCreditLimit',
			type: Number
		}
	};

	try {
		var sql;
		let fileToArray = [];
		await readXlsxFile(`${process.env.PUBLIC_URL}review_old_credit/${req.file.originalname}`, { schema }).then(({ rows, errors }) => {
			fileToArray = rows;
		});

		fileToArray.forEach(async (row) => {
			sql = await knex.raw(`UPDATE cr_retail_limit
    			SET credit_amount = ${row.newCreditLimit},
    			temp = allowed_limit,
    			allowed_limit = ( SELECT ${row.newCreditLimit} * allowed_percentage / 100 FROM cr_limit_config WHERE cr_limit_config.id_point = cr_retail_limit.id_point ),
    			daily_limit = ( SELECT ${row.newCreditLimit} * daily_percentage / 100 FROM cr_limit_config WHERE cr_limit_config.id_point = cr_retail_limit.id_point ),
    			current_balance = current_balance + allowed_limit - temp
    			WHERE
    			outlet_code = '${row.outletCode}'`);
		})

		const logData = {
			created_by: req.body.user_id,
			file_name: req.file.originalname,
		}

		await knex('cr_limit_review_upload_log').insert(logData);

		res.send(sendApiResult(true, "Limit updated successfully"));
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
}


exports.limitConfirmedCreditsDownloads = async (req, res) => {
	try {
		const data = await knex("cr_retail_limit")
			.select(
				"cr_retail_limit.outlet_code",
				"cr_retail_limit.outlet_name",
				"cr_retail_limit.owner_name",
				"cr_retail_limit.phone",
				"cr_retail_limit.address",
				"cr_retail_limit.credit_amount",
				"cr_retail_limit.acc_no",
				"cr_retail_limit.allowed_limit",
				"cr_retail_limit.daily_limit",
				"cr_retail_limit.loan_account_number",
				"cr_retail_limit.client_id",
				knex.raw(
					`DATE_FORMAT(cr_retail_limit.effective_date, "%d-%b-%Y") as effective_date`
				),
				knex.raw(
					`DATE_FORMAT(cr_retail_limit.end_date, "%d-%b-%Y") as end_date_formated`
				),
				knex.raw(`distributorspoint.name as point_name`),
				knex.raw("cr_fi_institute.name as fi_name")
			)
			.leftJoin(
				"distributorspoint",
				"distributorspoint.id",
				"cr_retail_limit.id_point"
			)
			.leftJoin("cr_dh_fi", "distributorspoint.dsid", "cr_dh_fi.id_dh")
			.leftJoin("cr_fi_institute", "cr_fi_institute.id", "cr_dh_fi.id_fi")
			.whereIn("cr_retail_limit.id_point", req.body.id_point)
			.where(function () {
				this.whereBetween("cr_retail_limit.effective_date", [
					req.body.date_from,
					req.body.date_to
				]);
				this.orWhereBetween("cr_retail_limit.end_date", [
					req.body.date_from,
					req.body.date_to
				]);
			})
			.where({ "cr_retail_limit.activation_status": "Active" });
		console.log(data);
		const numberCast = ["credit_amount", "allowed_limit", "daily_limit", "client_id"];
		var headers;
		if (req.body.usertype == "fi") {
			headers = {
				point_name: "Point Name",
				outlet_code: "Outlet Code",
				outlet_name: "Outlet Name",
				owner_name: "Owner Name",
				phone: "Phone",
				address: "Address",
				credit_amount: "Credit Amount",
				// acc_no: "Account No.",
				loan_account_number: "Loan Account No.",
				client_id: "Customer ID",
				fi_name: "Bank name",
				effective_date: "Effective Date",
				end_date_formated: "End Date"
			};
		} else {
			headers = {
				point_name: "Point Name",
				outlet_code: "Outlet Code",
				outlet_name: "Outlet Name",
				owner_name: "Owner Name",
				phone: "Phone",
				address: "Address",
				credit_amount: "Credit Amount",
				allowed_limit: "Allowed Limit",
				daily_limit: "Daily Limit",
				// acc_no: "Account No.",
				loan_account_number: "Loan Account No.",
				client_id: "Customer ID",
				fi_name: "Bank name",
				end_date_formated: "End Date"
			};
		}
		const fileName = generaeteExcel(
			headers,
			data,
			"Confirmed_Credit_Limit",
			numberCast
		);

		const url = generateBlobDownloadURL(fileName);

		res.send(sendApiResult(true, "File Generated", url));
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.getCreditSummaryOfOutlets = async (req, res) => {
	try {
		const getCreditSummaryOfOutlets =
			await CreditModel.getCreditSummaryOfOutlets(req, res);
		res.status(200).send(getCreditSummaryOfOutlets);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.getCreditSummaryOfOutletsDownload = async (req, res) => {
	try {
		var dpids = req.body.dpids;
		var filterText = req.body.filterText;
		const report_data = await knex("cr_retail_limit")
			.select(
				"cr_retail_limit.*",
				knex.raw(`distributorspoint.name as point_name`),
				knex.raw("cr_fi_institute.name as fi_name")
			)
			.innerJoin(
				"distributorspoint",
				"distributorspoint.id",
				"cr_retail_limit.id_point"
			)
			.innerJoin("cr_dh_fi", "distributorspoint.dsid", "cr_dh_fi.id_dh")
			.innerJoin("cr_fi_institute", "cr_fi_institute.id", "cr_dh_fi.id_fi")
			.where(function () {
				this.whereIn("cr_retail_limit.id_point", dpids);
				if (filterText) {
					var search_param = filterText
						.toLowerCase()
						.replace(/\s/g, "");
					this.whereRaw(
						`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`
					);
				}
			})
			.where({ "cr_retail_limit.activation_status": "Active" });

		console.log(report_data);

		var headers = [
			"SL No.",
			"Point",
			"Outlet Code",
			"Outlet Name",
			"Owner Name",
			"Phone",
			"Cr. Amount",
			"Allowed Limit",
			"Daily Limit",
			"Current Balance",
			"Total Due",
			"Minimum Due",
			"Carry Amount",
			"FI Name",
			"Acc. No."
		];
		var workbook = new excel.Workbook();
		var worksheet = workbook.addWorksheet("Sheet 1");
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
		row++;
		for (let i = 0; i < report_data.length; i++) {
			var col_add = 0;
			let e = report_data[i];
			worksheet.cell(row, col + col_add).number(i + 1);
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.point_name ? e.point_name : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.outlet_code ? e.outlet_code : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.outlet_name ? e.outlet_name : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.owner_name ? e.owner_name : "");
			col_add++;
			worksheet.cell(row, col + col_add).string(e.phone ? e.phone : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.credit_amount ? e.credit_amount : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.allowed_limit ? e.allowed_limit : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.daily_limit ? e.daily_limit : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.current_balance ? e.current_balance : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.total_due ? e.total_due : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.minimum_due ? e.minimum_due : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.carry_amount ? e.carry_amount : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.fi_name ? e.fi_name : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.point_name ? e.point_name : "");
			col_add++;
			row++;
		}
		workbook.write(`${process.env.PUBLIC_URL}reports/getCreditSummaryOfOutlets.xlsx`);
		const fileName = "reports/getCreditSummaryOfOutlets.xlsx";
		const url = generateBlobDownloadURL(fileName);
		res.send(sendApiResult(true, "Report File Generated", url));
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.limitConfirmedCreditById = async (req, res) => {
	try {
		console.log(req.params.id);
		const limitConfirmedCredit =
			await CreditModel.getLimitConfirmedCreditById(req, res);
		res.status(200).send(limitConfirmedCredit);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.limitConfirmedCreditUpdateById = async (req, res) => {
	try {
		const limitConfirmedCreditUpdateById =
			await CreditModel.limitConfirmedCreditUpdateById(req, res);
		res.status(200).send(req.params.id);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.getFileUploads = async (req, res) => {
	try {
		const getFileUploads = await CreditModel.getFileUploads(req, res);
		res.status(200).send(getFileUploads);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.insertCreditConfig = async (req, res) => {
	try {
		const insert = await CreditModel.insertCreditConfig(req.body);

		res.status(200).send(
			sendApiResult(true, "Credit Config Inserted Successfully")
		);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.creditLimitConfigList = async (req, res) => {
	try {
		const dh = await CreditModel.creditLimitConfigList(req);
		res.status(200).send(dh);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.getConfigById = async (req, res) => {
	try {
		const data = await CreditModel.getConfigById(req.params.id);
		res.status(200).send(data);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.updateConfig = async (req, res) => {
	try {
		const data = await CreditModel.updateConfig(req);
		res.status(200).send(data);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.approveCreditLimit = async (req, res) => {
	try {
		const approveCreditLimit = await CreditModel.approveCreditLimit(
			req,
			res
		);
		res.status(200).send(approveCreditLimit);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.limitConfirmedLogDetails = async (req, res) => {
	try {
		const limitConfirmedLogDetails =
			await CreditModel.limitConfirmedLogDetails(req, res);
		res.status(200).send(limitConfirmedLogDetails);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.downloadLogDetails = async (req, res) => {
	try {
		const log_data = await knex
			.from("cr_retail_limit_log_details")
			.where("id_cr_retail_limit_log", req.body.id)
			.orderBy("id", "asc");
		var outlet_codes = [];
		for (let i = 0; i < log_data.length; i++) {
			outlet_codes.push(log_data[i].outlet_code);
		}

		var retailers = await knex
			.from("retailers")
			.leftJoin(
				"distributorspoint",
				"distributorspoint.id",
				"retailers.dpid"
			)
			.leftJoin("company", "company.id", "distributorspoint.dsid")
			.where("retailers.stts", 1)
			.whereIn("retailer_code", outlet_codes)
			.select(
				knex.raw(`distributorspoint.name as dp_name`),
				knex.raw(`company.name as dh_name`),
				"retailers.retailer_code"
			);
		var retailers_obj = {};
		for (let i = 0; i < retailers.length; i++) {
			const element = retailers[i];
			retailers_obj[element.retailer_code] = {
				dp_name: element.dp_name ? element.dp_name : "",
				dh_name: element.dh_name ? element.dh_name : ""
			};
		}
		var headers = [
			"SL",
			"Outlet Code",
			"Owner Name",
			"Outlet Name",
			"Contact",
			"Address",
			"Account Number",
			"Cr Amount",
			"House Name",
			"Point Name"
		];
		var workbook = new excel.Workbook();
		var worksheet = workbook.addWorksheet("Sheet 1");
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
		row++;
		for (let i = 0; i < log_data.length; i++) {
			var col_add = 0;
			let e = log_data[i];
			worksheet.cell(row, col + col_add).number(i + 1);
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.outlet_code ? e.outlet_code : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.owner_name ? e.owner_name : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.outlet_name ? e.outlet_name : "");
			col_add++;
			worksheet.cell(row, col + col_add).string(e.phone ? e.phone : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.address ? e.address : "");
			col_add++;
			worksheet.cell(row, col + col_add).string(e.acc_no ? e.acc_no : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.number(e.credit_amount ? e.credit_amount : 0);
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(
					retailers_obj[e.outlet_code].dh_name
						? retailers_obj[e.outlet_code].dh_name
						: ""
				);
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(
					retailers_obj[e.outlet_code].dp_name
						? retailers_obj[e.outlet_code].dp_name
						: ""
				);
			col_add++;
			row++;
		}
		workbook.write(`${process.env.PUBLIC_URL}log_details/log_details.xlsx`);
		const fileName = "log_details/log_details.xlsx";
		const url = generateBlobDownloadURL(fileName);
		res.send(sendApiResult(true, "Modificatin File Generated", url));
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.getOutletCredit = async (req, res) => {
	try {
		var dpid = req.params.dpid;
		const results = await CreditModel.getOutletCredit(dpid);
		res.status(200).send(results);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.getOutletCreditByOutletId = async (req, res) => {
	try {
		var outletId = req.params.outletId;
		let outlet_credit = await OutletCreditInfo(outletId);

		if (Object.keys(outlet_credit).length) {
			res.status(200).send(
				sendApiResult(
					true,
					"Outlet Credit Info By Outlet/Retailer ID",
					outlet_credit
				)
			);
		} else {
			res.send(sendApiResult(false, "No outlet found"));
		}
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.creditLimitByPoint = async (req, res) => {
	try {
		const creditLimitByPoint = await CreditModel.creditLimitByPoint(
			req,
			res
		);
		res.status(200).send(creditLimitByPoint);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.creditLimitUpdateByPoint = async (req, res) => {
	try {
		const creditLimitUpdateByPoint =
			await CreditModel.creditLimitUpdateByPoint(req, res);
		res.status(200).send(creditLimitUpdateByPoint);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.creditLimitDeleteByPoint = async (req, res) => {
	try {
		const creditLimitDeleteByPoint =
			await CreditModel.creditLimitDeleteByPoint(req, res);
		res.status(200).send(creditLimitDeleteByPoint);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};
exports.creditLimitInsert = async (req, res) => {
	try {
		const creditLimitInsert = await CreditModel.creditLimitInsert(req, res);
		res.status(200).send(creditLimitInsert);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.scopeOutletsByRoute = async (req, res) => {
	try {
		const data = await CreditModel.scopeOutletsByRoute(req);
		res.status(200).send(data);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.generateFiCreditUploadSample = async (req, res) => {
	try {
		const limit_data = await knex("cr_retail_limit")
			.leftJoin("cr_dh_fi", "cr_dh_fi.id_dh", "cr_retail_limit.id_dh")
			.leftJoin("company", "company.id", "cr_retail_limit.id_dh")
			.leftJoin(
				"distributorspoint",
				"distributorspoint.id",
				"cr_retail_limit.id_point"
			)
			.leftJoin(
				"company_territory",
				"company_territory.territory",
				"distributorspoint.territory"
			)
			.where("cr_dh_fi.id_fi", req.params.id)
			//.whereNull("id_cr_limit_info")
			.where("limit_status", "Scope uploaded")
			.where("kyc_status", "Approved")
			.where("cr_retail_limit.activation_status", "Active")
			.whereNotIn("cr_retail_limit.id_point", [334, 344])
			.select(
				"cr_retail_limit.outlet_code",
				"cr_retail_limit.owner_name",
				"cr_retail_limit.outlet_name",
				"cr_retail_limit.phone",
				"cr_retail_limit.address",
				"cr_retail_limit.loan_account_number",
				"cr_retail_limit.client_id",
				knex.raw(`company.name as house_name`),
				knex.raw(`distributorspoint.name as point_name`),
				knex.raw(`company_territory.name as territory_name`)
			)
			.groupBy("cr_retail_limit.outlet_code");

		var headers = [
			"SL No.",
			"Outlet Code",
			"Owner Name",
			"Outlet Name",
			"Contact",
			"Address",
			"Account Number",
			"Credit Limit (Upto)",
			"DH Name",
			"Point Name",
			"Territory Name",
			"Customer ID"
		];
		var workbook = new excel.Workbook();
		var worksheet = workbook.addWorksheet("Sheet 1");
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
		row++;
		for (let i = 0; i < limit_data.length; i++) {
			var col_add = 0;
			let e = limit_data[i];
			worksheet.cell(row, col + col_add).number(i + 1);
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.outlet_code ? e.outlet_code : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.owner_name ? e.owner_name : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.outlet_name ? e.outlet_name : "");
			col_add++;
			worksheet.cell(row, col + col_add).string(e.phone ? e.phone : "");
			col_add++;
			worksheet.cell(row, col + col_add).string(e.address ? e.address : "");
			col_add++;
			worksheet.cell(row, col + col_add).string(e.loan_account_number ? e.loan_account_number : "");
			col_add++;
			worksheet.cell(row, col + col_add).string("");
			col_add++;
			// worksheet.cell(row, col + col_add).number(0);
			// col_add++;
			worksheet.cell(row, col + col_add).string(e.house_name);
			col_add++;
			worksheet.cell(row, col + col_add).string(e.point_name);
			col_add++;
			worksheet.cell(row, col + col_add).string(e.territory_name);
			col_add++;
			worksheet.cell(row, col + col_add).string(e.client_id);
			col_add++;
			row++;
		}
		await workbook.write(
			`${process.env.PUBLIC_URL}samples/scop_outlets_with_credit_limit_sample.xlsx`
		);
		const fileName =
			"samples/scop_outlets_with_credit_limit_sample.xlsx";
		const url = generateBlobDownloadURL(fileName);
		setTimeout(() => {
			res.send(sendApiResult(true, "Sample File Generated", url));
		}, 1500);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.downloadModificationFile = async (req, res) => {
	console.log("Here");
	try {
		var sql;
		if (req.body.status == "FI Initiated") {
			sql = `(SELECT
				t1.outlet_code,
				t1.outlet_name,
				t1.owner_name,
				t1.phone,
				t1.address,
				t1.acc_no,
				t1.credit_amount fi_init_amt
				FROM
				( SELECT * FROM cr_retail_limit_log_details WHERE id_cr_retail_limit_log = ( SELECT min( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.body.id} ) ) AS t1) as tdata`;
		} else if (
			req.body.status == "BAT Modified" ||
			req.body.status == "BAT Approved"
		) {
			sql = `(SELECT
				t1.outlet_code,
				t1.outlet_name,
				t1.owner_name,
				t1.phone,
				t1.address,
				t1.acc_no,
				t1.credit_amount fi_init_amt,
				t3.credit_amount bat_mod_app_amt 
				FROM
				( SELECT * FROM cr_retail_limit_log_details WHERE id_cr_retail_limit_log = ( SELECT min( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.body.id} ) ) AS t1,
				( SELECT * FROM cr_retail_limit_log_details WHERE id_cr_retail_limit_log = ( SELECT max( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.body.id} ) ) AS t3 
				WHERE
				t1.outlet_code = t3.outlet_code 
				#AND ( t1.credit_amount != t3.credit_amount)
				) as tdata`;
		} else {
			sql = `(SELECT
				t1.outlet_code,
				t1.outlet_name,
				t1.owner_name,
				t1.phone,
				t1.address,
				t1.acc_no,
				t1.credit_amount fi_init_amt,
				t2.credit_amount bat_mod_app_amt,
				t3.credit_amount fi_approved_amt
				FROM
				( SELECT * FROM cr_retail_limit_log_details WHERE id_cr_retail_limit_log = ( SELECT min( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.body.id} ) ) AS t1,
				(
				SELECT
				* 
				FROM
				cr_retail_limit_log_details 
				WHERE
				id_cr_retail_limit_log > ( SELECT min( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.body.id} ) 
				AND id_cr_retail_limit_log < ( SELECT max( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.body.id} ) 
				AND id_cr_limit_info = ${req.body.id} 
				) AS t2,
				( SELECT * FROM cr_retail_limit_log_details WHERE id_cr_retail_limit_log = ( SELECT max( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.body.id} ) ) AS t3 
				WHERE
				t1.outlet_code = t2.outlet_code 
				AND t1.outlet_code = t3.outlet_code 
				AND ( t1.credit_amount != t3.credit_amount OR t1.credit_amount != t2.credit_amount OR t2.credit_amount != t3.credit_amount )) as tdata`;
		}
		const comp_data = await knex(knex.raw(sql));
		var outlet_codes = [];
		for (let i = 0; i < comp_data.length; i++) {
			outlet_codes.push(comp_data[i].outlet_code);
		}

		var retailers = await knex
			.from("retailers")
			.leftJoin(
				"distributorspoint",
				"distributorspoint.id",
				"retailers.dpid"
			)
			.leftJoin("company", "company.id", "distributorspoint.dsid")
			.where("retailers.stts", 1)
			.whereIn("retailer_code", outlet_codes)
			.select(
				knex.raw(`distributorspoint.name as dp_name`),
				knex.raw(`company.name as dh_name`),
				"retailers.retailer_code"
			);
		console.log("------------------------ retailers ------------------------")
		console.log(retailers);
		var retailers_obj = {};
		for (let i = 0; i < retailers.length; i++) {
			const element = retailers[i];
			retailers_obj[element.retailer_code] = {
				dp_name: element.dp_name,
				dh_name: element.dh_name
			};
		}

		var headers = [
			"SL",
			"Outlet Code",
			"Owner Name",
			"Outlet Name",
			"Contact",
			"Address",
			"Account Number"
		];
		if (req.body.status == "FI Initiated") {
			headers.push("Modify This Column");
			headers.push("FI Initiated Amount");
		} else if (
			req.body.status == "BAT Modified" ||
			req.body.status == "BAT Approved"
		) {
			headers.push("Modify This Column");
			headers.push("FI Initiated Amount");
			headers.push("BAT Modified Amount");
		} else {
			headers.push("FI Initiated Amount");
			headers.push("BAT Modified Amount");
			headers.push("Limit Confirmed Amount");
		}
		headers.push("House Name");
		headers.push("Point Name");
		var workbook = new excel.Workbook();
		var worksheet = workbook.addWorksheet("Sheet 1");
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
		row++;
		for (let i = 0; i < comp_data.length; i++) {
			var col_add = 0;
			let e = comp_data[i];
			worksheet.cell(row, col + col_add).number(i + 1);
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.outlet_code ? e.outlet_code : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.owner_name ? e.owner_name : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.outlet_name ? e.outlet_name : "");
			col_add++;
			worksheet.cell(row, col + col_add).string(e.phone ? e.phone : "");
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(e.address ? e.address : "");
			col_add++;
			worksheet.cell(row, col + col_add).string(e.acc_no ? e.acc_no : "");
			col_add++;

			if (req.body.status == "FI Initiated") {
				worksheet
					.cell(row, col + col_add)
					.number(e.fi_init_amt ? e.fi_init_amt : "");
				col_add++;
				worksheet
					.cell(row, col + col_add)
					.number(e.fi_init_amt ? e.fi_init_amt : "");
				col_add++;
			} else if (
				req.body.status == "BAT Modified" ||
				req.body.status == "BAT Approved"
			) {
				worksheet
					.cell(row, col + col_add)
					.number(e.bat_mod_app_amt ? e.bat_mod_app_amt : "");
				col_add++;
				worksheet
					.cell(row, col + col_add)
					.number(e.fi_init_amt ? e.fi_init_amt : "");
				col_add++;
				worksheet
					.cell(row, col + col_add)
					.number(e.bat_mod_app_amt ? e.bat_mod_app_amt : "");
				col_add++;
			} else {
				worksheet
					.cell(row, col + col_add)
					.number(e.fi_init_amt ? e.fi_init_amt : "");
				col_add++;
				worksheet
					.cell(row, col + col_add)
					.number(e.bat_mod_app_amt ? e.bat_mod_app_amt : "");
				col_add++;
				worksheet
					.cell(row, col + col_add)
					.number(e.fi_approved_amt ? e.fi_approved_amt : "");
				col_add++;
			}
			worksheet
				.cell(row, col + col_add)
				.string(
					retailers_obj[e.outlet_code].dh_name
						? retailers_obj[e.outlet_code].dh_name
						: ""
				);
			col_add++;
			worksheet
				.cell(row, col + col_add)
				.string(
					retailers_obj[e.outlet_code].dp_name
						? retailers_obj[e.outlet_code].dp_name
						: ""
				);
			col_add++;
			row++;
		}
		workbook.write(
			`${process.env.PUBLIC_URL}modifications/credit_limit_modification_file.xlsx`
		);
		const fileName = "modifications/credit_limit_modification_file.xlsx";
		const url = generateBlobDownloadURL(fileName);
		res.send(sendApiResult(true, "Modificatin File Generated", url));
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};


exports.getOutletCreditDetails = async (req, res) => {
	try {
		var outletIds = req.body.outletIds;
		var route_id = req.body.route_id;
		let outlet_credit_details = await OutletCreditDetails(outletIds, route_id);

		if (Object.keys(outlet_credit_details).length) {
			res.status(200).send(
				sendApiResult(
					true,
					"Outlet Credit Info By Outlet/Retailer ID",
					outlet_credit_details
				)
			);
		} else {
			res.send(sendApiResult(false, "No outlet found"));
		}
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};