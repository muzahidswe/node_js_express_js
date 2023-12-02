const { sendApiResult } = require("../controllers/helperController");
const knex = require("../config/database");
const readXlsxFile = require("read-excel-file/node");
const { rejects } = require("assert");
const { leftJoin, where } = require("../config/database");
const xlsx = require("xlsx");
const { Console } = require("console");
var moment = require("moment");
require("dotenv").config();

exports.getLimitConfirmedCredits = async (req, res) => {
	return new Promise(async (resolve, reject) => {
		try {
			const limitConfirmedCredits = await knex("cr_retail_limit")
				.select(
					"cr_retail_limit.*",
					knex.raw(`distributorspoint.name as point_name`),
					knex.raw("cr_fi_institute.name as fi_name")
				)
				.leftJoin(
					"distributorspoint",
					"distributorspoint.id",
					"cr_retail_limit.id_point"
				)
				.leftJoin(
					"cr_dh_fi",
					"distributorspoint.dsid",
					"cr_dh_fi.id_dh"
				)
				.leftJoin(
					"cr_fi_institute",
					"cr_fi_institute.id",
					"cr_dh_fi.id_fi"
				)
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
			if (limitConfirmedCredits == 0)
				reject(sendApiResult(false, "Not found."));

			resolve(
				sendApiResult(
					true,
					"Confirmed limit fetched",
					limitConfirmedCredits
				)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	}).catch((error) => {
		console.log(error, "Promise error");
	});
};

exports.getCreditSummaryOfOutlets = async (req, res) => {
	var url = require("url");
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;
	var dpids = req.body.dpids;
	var filterText = req.body.filterText;
	return new Promise(async (resolve, reject) => {
		try {
			const limitConfirmedCredits = await knex("cr_retail_limit")
				.select(
					"cr_retail_limit.*",
					knex.raw(`distributorspoint.name as point_name`),
					knex.raw("cr_fi_institute.name as fi_name")
				)
				.leftJoin(
					"distributorspoint",
					"distributorspoint.id",
					"cr_retail_limit.id_point"
				)
				.leftJoin(
					"cr_dh_fi",
					"distributorspoint.dsid",
					"cr_dh_fi.id_dh"
				)
				.leftJoin(
					"cr_fi_institute",
					"cr_fi_institute.id",
					"cr_dh_fi.id_fi"
				)
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
				.where({ "cr_retail_limit.activation_status": "Active" })
				.paginate({
					perPage: query.per_page,
					currentPage: query.page,
					isLengthAware: true
				});
			if (limitConfirmedCredits == 0)
				reject(sendApiResult(false, "Not found."));

			resolve(
				sendApiResult(
					true,
					"Confirmed limit fetched",
					limitConfirmedCredits
				)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	}).catch((error) => {
		console.log(error, "Promise error");
	});
};

exports.getLimitConfirmedCreditById = async (req, res) => {
	return new Promise(async (resolve, reject) => {
		try {
			const limitConfirmedCredit = await knex("cr_retail_limit")
				.select("*")
				.where({ activation_status: "Active", id: req.params.id });
			if (limitConfirmedCredit == 0)
				reject(sendApiResult(false, "Not found."));

			resolve(
				sendApiResult(
					true,
					"Confirmed limit fetched",
					limitConfirmedCredit
				)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	}).catch((error) => {
		console.log(error, "Promise error");
	});
};

exports.limitConfirmedCreditUpdateById = async (req, res) => {
	return new Promise(async (resolve, reject) => {
		try {
			const limitConfirmedCredit = await knex("cr_retail_limit")
				.where({ activation_status: "Active", id: req.params.id })
				.update(req.body);
			if (limitConfirmedCredit == 0)
				reject(sendApiResult(false, "Not found."));

			resolve(
				sendApiResult(
					true,
					"Confirmed limit Updated",
					limitConfirmedCredit
				)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	}).catch((error) => {
		console.log(error, "Promise error");
	});
};

exports.getFileUploads = async (req, res) => {
	var url = require("url");
	var url_parts = url.parse(req.url, true);
	var query = url_parts.query;
	var dpids = req.body.dpids;
	var dhId = req.body.dhId;
	return new Promise(async (resolve, reject) => {
		try {
			const limitConfirmedCredit = await knex("cr_retail_limit_info")
				.select(
					"cr_retail_limit_info.id",
					"cr_retail_limit_info.id_fi",
					"cr_retail_limit_info.status",
					"cr_retail_limit_info.note",
					"cr_retail_limit_info.title",
					"cr_users.name",
					knex.raw(
						"(SELECT cr_retail_limit_log.file from cr_retail_limit_log where cr_retail_limit_log.id_cr_limit_info = cr_retail_limit_info.id ORDER BY  cr_retail_limit_log.id desc limit 1) as file"
					),
					knex.raw(
						'(SELECT DATE_FORMAT(cr_retail_limit_log_details.effective_date, "%Y-%m-%d") from cr_retail_limit_log_details where cr_retail_limit_log_details.id_cr_limit_info = cr_retail_limit_info.id ORDER BY  cr_retail_limit_log_details.id desc limit 1) as effective_date'
					),
					knex.raw(
						'(SELECT DATE_FORMAT(cr_retail_limit_log_details.end_date, "%Y-%m") from cr_retail_limit_log_details where cr_retail_limit_log_details.id_cr_limit_info = cr_retail_limit_info.id ORDER BY  cr_retail_limit_log_details.id desc limit 1) as end_date'
					),
					knex.raw(`cr_users.name as uploaded_by`),
					knex.raw(
						`DATE_FORMAT(cr_retail_limit_info.created_at, "%d %b %y") as uploaded_at`
					)
				)
				.leftJoin(
					"cr_users",
					"cr_retail_limit_info.created_by",
					"cr_users.id"
				)
				.leftJoin(
					"cr_retail_limit",
					"cr_retail_limit.id_cr_limit_info",
					"cr_retail_limit_info.id"
				)
				.where({ "cr_retail_limit_info.activation_status": "Active" })
				.where(function () {
					if (typeof dhId !== "undefined") {
						this.whereIn("cr_retail_limit.id_dh", dhId);
					} else {
						// if (req.body.cr_user_type !== "admin") {
						// 	this.whereIn("cr_retail_limit.id_point", dpids);
						// }
					}

					if (req.body.cr_user_type == "fi") {
						this.where(
							"cr_retail_limit_info.id_fi",
							req.body.fi_id
						);
					}
				})
				.groupBy("cr_retail_limit_info.id")
				.orderBy("cr_retail_limit_info.id", "desc")
				.paginate({
					perPage: query.per_page,
					currentPage: query.page,
					isLengthAware: true
				});

			if (limitConfirmedCredit == 0)
				reject(sendApiResult(false, "Not found."));

			resolve(
				sendApiResult(
					true,
					"Confirmed limit fetched",
					limitConfirmedCredit
				)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	}).catch((error) => {
		console.log(error, "Promise error");
	});
};

exports.insertCreditConfig = function ({
	point_id,
	allowed_percentage,
	effective_percentage,
	monthly_percentage,
	daily_percentage,
	created_by
}) {
	return knex.transaction((trx) => {
		let queries = [];
		point_id.forEach((e) => {
			const query = knex("cr_limit_config")
				.insert({
					id_point: e,
					allowed_percentage,
					effective_percentage: effective_percentage
						? effective_percentage
						: 0,
					monthly_percentage: monthly_percentage
						? monthly_percentage
						: 0,
					daily_percentage,
					created_by
				})
				.transacting(trx);
			queries.push(query);
		});

		Promise.all(queries).then(trx.commit).catch(trx.rollback);
	});
};

exports.creditLimitConfigList = function (req) {
	return new Promise(async (resolve, reject) => {
		try {
			const data = await knex
				.from("cr_limit_config")
				.select(
					"cr_limit_config.id",
					"cr_limit_config.id_point",
					"distributorspoint.name as point_name",
					"cr_limit_config.allowed_percentage",
					"cr_limit_config.effective_percentage",
					"cr_limit_config.monthly_percentage",
					"cr_limit_config.daily_percentage",
					knex.raw("company.name as dh_name")
				)
				.leftJoin(
					"distributorspoint",
					"distributorspoint.id",
					"cr_limit_config.id_point"
				)
				.leftJoin("company", "company.id", "distributorspoint.dsid")
				.where("cr_limit_config.activation_status", "Active");
			// .paginate({
			//     perPage: query.per_page,
			//     currentPage: query.page,
			//     isLengthAware: true
			// });
			console.log(data);
			resolve(
				sendApiResult(
					true,
					"Credit limit configuration fetched successfully",
					data
				)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	});
};

exports.getConfigById = function (id) {
	return new Promise(async (resolve, reject) => {
		try {
			const data = await knex
				.from("cr_limit_config")
				.where("id", id)
				.first();

			resolve(
				sendApiResult(
					true,
					"Credit limit configuration fetched successfully",
					data
				)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	});
};

exports.updateConfig = function (req) {
	return new Promise(async (resolve, reject) => {
		try {
			await knex
				.transaction(async (trx) => {
					const config_data = await trx("cr_limit_config")
						.where("id", req.body.id)
						.first();

					const updateLimits = await trx("cr_retail_limit")
						.where("id_point", config_data.id_point)
						.update({
							allowed_limit: trx.raw(
								`credit_amount *` +
								req.body.allowed_percentage / 100
							),
							daily_limit: trx.raw(
								`allowed_limit * ` +
								req.body.daily_percentage / 100
							),
							current_balance: trx.raw(
								`GREATEST(current_balance + credit_amount * ((` +
								req.body.allowed_percentage +
								` - (select allowed_percentage from cr_limit_config where id_point = ` +
								config_data.id_point +
								`)) / 100) , 0)`
							)
						});
					const updateSettings = await trx("cr_limit_config")
						.where("id", req.body.id)
						.update({
							allowed_percentage: req.body.allowed_percentage,
							daily_percentage: req.body.daily_percentage
						});
					resolve(
						sendApiResult(
							true,
							"Credit limit configuration updated successfully"
						)
					);
				})
				.then((result) => { })
				.catch((error) => {
					reject(sendApiResult(false, "Error occured."));
					console.log(error.message);
				});
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	});
};

exports.approveCreditLimit = function (req, res) {
	const cr_user_type = req.params.cr_user_type;
	const cr_retail_limit_info_id = req.params.cr_retail_limit_info_id;
	const userId = req.body.userId;
	var statuToUpdate, statusToUpdateInLimitTable;
	if (cr_user_type == "fi") {
		statuToUpdate = "Limit confirmed";
		statusToUpdateInLimitTable = "FI Confirmed";
	}
	if (cr_user_type == "superadmin") {
		statuToUpdate = "BAT Approved";
		statusToUpdateInLimitTable = "BAT Approve / Modified";
	}

	return new Promise(async (resolve, reject) => {
		try {
			await knex
				.transaction(async (trx) => {
					const crRetailLimitInfoUpdate = await trx(
						"cr_retail_limit_info"
					)
						.where("id", cr_retail_limit_info_id)
						.update({
							status: statuToUpdate
						});

					//console.log("---------- cr_retail_limit_info ------------");
					console.log(crRetailLimitInfoUpdate);
					const last_cr_retail_limit_log_info = await trx(
						"cr_retail_limit_log"
					)
						.where("id_cr_limit_info", cr_retail_limit_info_id)
						.orderBy("id", "desc")
						.first();

					const last_cr_retail_limit_log_id =
						last_cr_retail_limit_log_info.id;

					var file = last_cr_retail_limit_log_info.file;

					var cr_limit_log_obj = {
						id_cr_limit_info: cr_retail_limit_info_id,
						file: file,
						status: statuToUpdate,
						created_by: userId
					};

					const crRetailLimitLogInsert = await trx
						.insert(cr_limit_log_obj)
						.into("cr_retail_limit_log");
					var sql =
						"INSERT INTO cr_retail_limit_log_details (id_cr_limit_info,id_cr_retail_limit_log,acc_no,outlet_code,outlet_name,owner_name,phone,address,credit_amount,effective_date,duration,end_date,created_by)";
					sql +=
						" SELECT id_cr_limit_info, " +
						crRetailLimitLogInsert[0] +
						", acc_no,outlet_code,outlet_name,owner_name,phone,address,credit_amount,effective_date,duration,end_date," +
						userId;
					sql +=
						" FROM cr_retail_limit_log_details WHERE id_cr_retail_limit_log = " +
						last_cr_retail_limit_log_id;

					const insert = await trx.raw(sql);

					// For updating 'id_cr_limit_info' only in 'cr_retail_limit' table
					const update_retail_limit_table = await trx(
						"cr_retail_limit"
					)
						.where("id_cr_limit_info", cr_retail_limit_info_id)
						.update({
							limit_status: statusToUpdateInLimitTable
						});

					if (statuToUpdate == "Limit confirmed") {
						const filePathInfo = await trx("cr_retail_limit_log")
							.where("id_cr_limit_info", cr_retail_limit_info_id)
							.orderBy("id", "desc")
							.first();

						const filePath = filePathInfo.file;
						const logDetails = await trx(
							"cr_retail_limit_log_details"
						)
							.where("id_cr_limit_info", cr_retail_limit_info_id)
							.orderBy("id", "desc")
							.first();

						var rows = [];
						var workbook = xlsx.readFile(
							process.env.PUBLIC_URL + "uploads/" + filePath,
							{ type: "array" }
						);
						const sheetnames = Object.keys(workbook.Sheets);
						let i = sheetnames.length;
						while (i--) {
							const sheetname = sheetnames[i];
							arrayName = sheetname.toString();
							rows = xlsx.utils.sheet_to_json(
								workbook.Sheets[sheetname]
							);
							var retailers = await knex
								.from("retailers")
								.where("stts", 1)
								.select("dpid", "id", "retailer_code");

							var retailers_obj = {};
							for (let i = 0; i < retailers.length; i++) {
								const element = retailers[i];
								retailers_obj[element.retailer_code] = {
									id: element.id,
									dpid: element.dpid
								};
							}
							let config_details = await trx
								.from("cr_limit_config")
								.select(
									"allowed_percentage",
									"daily_percentage",
									"id_point"
								)
								.where("activation_status", "Active");

							var config_details_obj = {};
							for (let i = 0; i < config_details.length; i++) {
								const element = config_details[i];
								config_details_obj[element.id_point] = {
									allowed_percentage:
										element.allowed_percentage,
									daily_percentage: element.daily_percentage
								};
							}

							var outlet_codes = [];

							for (let index = 0; index < rows.length; index++) {
								let array = Object.values(rows[index]);
								if (!array[1] || array[1] === "") {
									continue;
								}

								outlet_codes.push(array[1]);

								let allowed_percentage = 100;
								let daily_percentage = 50;
								if (
									typeof retailers_obj[array[1]] !==
									"undefined"
								) {
									allowed_percentage =
										typeof config_details_obj[
											retailers_obj[array[1]].dpid
										] !== "undefined"
											? config_details_obj[
												retailers_obj[array[1]].dpid
											].allowed_percentage
											: 100;
									daily_percentage =
										typeof config_details_obj[
											retailers_obj[array[1]].dpid
										] !== "undefined"
											? config_details_obj[
												retailers_obj[array[1]].dpid
											].daily_percentage
											: 50;
								}

								let credit_amount = parseFloat(array[7]);
								let allowed_limit =
									(credit_amount * allowed_percentage) / 100;
								let daily_limit =
									(allowed_limit * daily_percentage) / 100;

								let old_allowed_limit_current_balance =
									await knex("cr_retail_limit")
										.select(
											"allowed_limit",
											"current_balance"
										)
										.where("outlet_code", array[1])
										.first();

								let diff_of_allowed_limit =
									parseFloat(allowed_limit) -
									parseFloat(
										old_allowed_limit_current_balance.allowed_limit
									);

								let current_balance =
									parseFloat(
										old_allowed_limit_current_balance.current_balance
									) + parseFloat(diff_of_allowed_limit);

								let temp = {
									id_cr_limit_info: cr_retail_limit_info_id,
									acc_no: array[6],
									outlet_code: array[1],
									owner_name: array[2],
									outlet_name: array[3],
									phone: array[4],
									address: array[5],
									credit_amount: credit_amount,
									allowed_limit: allowed_limit,
									current_balance: current_balance,
									daily_limit: daily_limit,
									updated_by: userId,
									effective_date: logDetails.effective_date,
									duration: logDetails.duration,
									id_outlet:
										typeof retailers_obj[array[1]] !==
											"undefined"
											? retailers_obj[array[1]].id
											: null,
									id_point:
										typeof retailers_obj[array[1]] !==
											"undefined"
											? retailers_obj[array[1]].dpid
											: null,
									end_date: logDetails.end_date
								};
								// console.log(array[1] + ' => ' + allowed_limit + ' => ' + daily_limit);
								let retail_limit_update = await trx(
									"cr_retail_limit"
								)
									.where(
										"id_outlet",
										retailers_obj[array[1]].id
									)
									.update(temp);
								//limit_confirmed_obj.push(temp);
								// console.log(index);							
							}

							const not_in_existing_logs = await trx(
								"cr_retail_limit_log_details"
							)
								.whereNotIn("outlet_code", outlet_codes)
								.where(
									"id_cr_retail_limit_log",
									last_cr_retail_limit_log_id
								);
							for (
								let i = 0;
								i < not_in_existing_logs.length;
								i++
							) {
								let allowed_percentage = 100;
								let daily_percentage = 50;
								if (
									typeof retailers_obj[
									not_in_existing_logs[i].outlet_code
									] !== "undefined"
								) {
									allowed_percentage =
										typeof config_details_obj[
											retailers_obj[
												not_in_existing_logs[i]
													.outlet_code
											].dpid
										] !== "undefined"
											? config_details_obj[
												retailers_obj[
													not_in_existing_logs[i]
														.outlet_code
												].dpid
											].allowed_percentage
											: 100;
									daily_percentage =
										typeof config_details_obj[
											retailers_obj[
												not_in_existing_logs[i]
													.outlet_code
											].dpid
										] !== "undefined"
											? config_details_obj[
												retailers_obj[
													not_in_existing_logs[i]
														.outlet_code
												].dpid
											].daily_percentage
											: 50;
								}
								let credit_amount = parseFloat(
									not_in_existing_logs[i].credit_amount
								);
								let allowed_limit =
									(credit_amount * allowed_percentage) / 100;
								let daily_limit =
									(allowed_limit * daily_percentage) / 100;

								console.log(
									not_in_existing_logs[i].outlet_code
								);

								let old_allowed_limit_current_balance =
									await knex("cr_retail_limit")
										.select(
											"allowed_limit",
											"current_balance"
										)
										.where(
											"outlet_code",
											not_in_existing_logs[i].outlet_code
										)
										.first();

								let diff_of_allowed_limit =
									parseFloat(allowed_limit) -
									parseFloat(
										old_allowed_limit_current_balance.allowed_limit
									);

								let current_balance =
									parseFloat(
										old_allowed_limit_current_balance.current_balance
									) + parseFloat(diff_of_allowed_limit);

								let temp2 = {
									id_cr_limit_info: cr_retail_limit_info_id,
									outlet_code:
										not_in_existing_logs[i].outlet_code,
									owner_name:
										not_in_existing_logs[i].owner_name,
									outlet_name:
										not_in_existing_logs[i].outlet_name,
									phone: not_in_existing_logs[i].phone,
									address: not_in_existing_logs[i].address,
									credit_amount: credit_amount,
									allowed_limit: allowed_limit,
									daily_limit: daily_limit,
									current_balance: current_balance,
									acc_no: not_in_existing_logs[i].acc_no,
									created_by: req.created_by,
									effective_date:
										not_in_existing_logs[i].effective_date,
									duration: not_in_existing_logs[i].duration,
									id_outlet:
										typeof retailers_obj[
											not_in_existing_logs[i].outlet_code
										] !== "undefined"
											? retailers_obj[
												not_in_existing_logs[i]
													.outlet_code
											].id
											: null,
									id_point:
										typeof retailers_obj[
											not_in_existing_logs[i].outlet_code
										] !== "undefined"
											? retailers_obj[
												not_in_existing_logs[i]
													.outlet_code
											].dpid
											: null,
									end_date: moment(
										not_in_existing_logs[i].effective_date
									)
										.add(
											not_in_existing_logs[i].duration,
											"days"
										)
										.format("YYYY-MM-DD"),
									kyc_status: "Approved"
								};

								console.log(
									not_in_existing_logs[i].outlet_code
								);
								console.log(old_allowed_limit_current_balance);
								console.log(current_balance);

								console.log('retailers_obj');
								console.log(retailers_obj);

								let retail_limit_update = await trx(
									"cr_retail_limit"
								)
									.where(
										"id_cr_limit_info",
										cr_retail_limit_info_id
									)
									.where(
										"id_outlet",
										retailers_obj[
											not_in_existing_logs[i].outlet_code
										].id
									)
									.update(temp2);
							}
							//const retail_limit_insert = await trx.batchInsert("cr_retail_limit",limit_confirmed_obj, 50);
						}
					}

					resolve(
						sendApiResult(
							true,
							"Data inserted Successfully",
							crRetailLimitLogInsert
						)
					);

				})
				.then((result) => { })
				.catch((error) => {
					console.log(error.message);
				});

			resolve(sendApiResult(true, "Approved successfully"));
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	});
};

exports.limitConfirmedLogDetails = function (req, res) {
	return new Promise(async (resolve, reject) => {
		try {
			const data = await knex
				.from("cr_retail_limit_log")
				.select(
					"id",
					"note",
					"status",
					knex.raw(
						`DATE_FORMAT(created_at, "%d %b %y") as created_at`
					)
				)
				.where("id_cr_limit_info", req.params.id)
				.orderBy("id", "asc");
			resolve(
				sendApiResult(
					true,
					"Credit limit log fetched successfully",
					data
				)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	});
};

exports.creditLimitByPoint = function (req, res) {
	return new Promise(async (resolve, reject) => {
		try {
			const data = await knex
				.from("cr_limit_config")
				.select(
					"cr_limit_config.*",
					knex.raw(`distributorspoint.name as point_name`)
				)
				.leftJoin(
					"distributorspoint",
					"distributorspoint.id",
					"cr_limit_config.id_point"
				)
				.where("cr_limit_config.id_point", req.params.id)
				.where("cr_limit_config.activation_status", "Active")
				.orderBy("cr_limit_config.id", "desc")
				.first();
			resolve(
				sendApiResult(
					true,
					"Credit limit config fetched successfully",
					data
				)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	});
};

exports.creditLimitUpdateByPoint = function (req, res) {
	return new Promise(async (resolve, reject) => {
		try {
			var update;
			const data = await knex.transaction(async (trx) => {
				update = await trx("cr_limit_config")
					.where({
						activation_status: "Active",
						id_point: req.params.id
					})
					.update(req.body);
			});
			if (update == 0) reject(sendApiResult(false, "Not found."));
			resolve(
				sendApiResult(
					true,
					"Credit limit config updated successfully",
					update
				)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	});
};

exports.creditLimitDeleteByPoint = function (req, res) {
	return new Promise(async (resolve, reject) => {
		try {
			var delete_data;
			const data = await knex.transaction(async (trx) => {
				delete_data = await trx("cr_limit_config")
					.where({
						activation_status: "Active",
						id_point: req.params.id
					})
					.update({ activation_status: "Inactive" });
			});
			if (delete_data == 0) reject(sendApiResult(false, "Not found."));
			resolve(
				sendApiResult(
					true,
					"Credit limit config deleted successfully",
					delete_data
				)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	});
};

exports.creditLimitInsert = function (req, res) {
	return new Promise(async (resolve, reject) => {
		try {
			var insert;
			const data = await knex.transaction(async (trx) => {
				insert = await trx("cr_limit_config").insert(req.body);
			});
			resolve(
				sendApiResult(
					true,
					"Credit limit config inserted successfully",
					insert
				)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	});
};
exports.getOutletCredit = function (dpid) {
	return new Promise(async (resolve, reject) => {
		try {
			const fi_info = await knex("retailers")
				.leftJoin(
					{ dp: "distributorspoint" },
					"retailers.dpid",
					"dp.id"
				)
				.leftJoin("cr_dh_fi", "dp.dsid", "cr_dh_fi.id_dh")
				.leftJoin({ fi: "cr_fi_institute" }, "cr_dh_fi.id_fi", "fi.id")
				.where("retailers.dpid", dpid)
				.select(
					knex.raw(
						"fi.name as fi_name, CONCAT('" +
						process.env.APP_URL +
						"'," +
						"'/download/fi_logos/'," +
						"fi.logo) as fi_logo"
					)
				)
				.first();

			const credits = await knex
				.select(
					knex.raw(`retail.id_outlet,
            retail.outlet_code,
            IFNULL(retail.allowed_limit,0) as total_limit,
            IFNULL(retail.current_balance,0) as current_balance,
            IFNULL(disbursement.paid_amount,0) as paid_amount,
            IFNULL(disbursement.due_amount,0) as due_amount,
            IFNULL(disbursement.total_interest_amount,0) as total_interest_amount,
            IFNULL(disbursement.total_paid_interest_amount,0) as total_paid_interest_amount`)
				)
				.from({ retail: "cr_retail_limit" })
				.leftJoin(
					{ disbursement: "cr_credit_disbursements" },
					function () {
						this.on(
							"retail.id_outlet",
							"=",
							"disbursement.id_outlet"
						);
						this.andOnVal(
							"disbursement.activation_status",
							"=",
							"Active"
						);
						this.andOnVal("disbursement.due_amount", "<>", 0);
					}
				)
				.where("retail.id_point", dpid)
				.andWhere("retail.activation_status", "Active");
			let outlet_credits = {};

			if (credits.length > 0) {
				credits.forEach((e) => {
					if (e.id_outlet in outlet_credits) {
						outlet_credits[e.id_outlet]["due_amount"] +=
							e.due_amount;
						outlet_credits[e.id_outlet]["total_interest_amount"] +=
							e.total_interest_amount;
						outlet_credits[e.id_outlet]["paid_amount"] +=
							e.paid_amount;
						outlet_credits[e.id_outlet][
							"total_paid_interest_amount"
						] += e.total_paid_interest_amount;
					} else {
						outlet_credits[e.id_outlet] = {
							id_outlet: e.id_outlet,
							outlet_code: e.outlet_code,
							total_limit: e.total_limit,
							current_balance: e.current_balance,
							paid_amount: e.paid_amount,
							due_amount: e.due_amount,
							total_interest_amount: e.total_interest_amount,
							total_paid_interest_amount:
								e.total_paid_interest_amount
							// fi_name:e.fi_name,
							// fi_logo: process.env.APP_URL + '/public/fi_logos/' + e.fi_logo
						};
					}
				});
			}
			outlet_credits["fi_info"] = fi_info;
			//if(credits ==0) resolve(sendApiResult(false,"Outlet Credits By point Fetch Failed"));

			resolve(
				sendApiResult(true, "Outlet Credit By point", outlet_credits)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	});
};

exports.getOutletCredit = function (dpid) {
	return new Promise(async (resolve, reject) => {
		try {
			const fi_info = await knex("retailers")
				.leftJoin(
					{ dp: "distributorspoint" },
					"retailers.dpid",
					"dp.id"
				)
				.leftJoin("cr_dh_fi", "dp.dsid", "cr_dh_fi.id_dh")
				.leftJoin({ fi: "cr_fi_institute" }, "cr_dh_fi.id_fi", "fi.id")
				.where("retailers.dpid", dpid)
				.select(
					knex.raw(
						"fi.name as fi_name, CONCAT('" +
						process.env.APP_URL +
						"'," +
						"'/download/fi_logos/'," +
						"fi.logo) as fi_logo"
					)
				)
				.first();

			const credits = await knex
				.select(
					knex.raw(`retail.id_outlet,
            retail.outlet_code,
            IFNULL(retail.allowed_limit,0) as total_limit,
            IFNULL(retail.current_balance,0) as current_balance,
            IFNULL(disbursement.paid_amount,0) as paid_amount,
            IFNULL(disbursement.due_amount,0) as due_amount,
            IFNULL(disbursement.total_interest_amount,0) as total_interest_amount,
            IFNULL(disbursement.total_paid_interest_amount,0) as total_paid_interest_amount`)
				)
				.from({ retail: "cr_retail_limit" })
				.leftJoin(
					{ disbursement: "cr_credit_disbursements" },
					function () {
						this.on(
							"retail.id_outlet",
							"=",
							"disbursement.id_outlet"
						);
						this.andOnVal(
							"disbursement.activation_status",
							"=",
							"Active"
						);
						this.andOnVal("disbursement.due_amount", "<>", 0);
					}
				)
				.where("retail.id_point", dpid)
				.andWhere("retail.activation_status", "Active");
			let outlet_credits = {};

			if (credits.length > 0) {
				credits.forEach((e) => {
					if (e.id_outlet in outlet_credits) {
						outlet_credits[e.id_outlet]["due_amount"] +=
							e.due_amount;
						outlet_credits[e.id_outlet]["total_interest_amount"] +=
							e.total_interest_amount;
						outlet_credits[e.id_outlet]["paid_amount"] +=
							e.paid_amount;
						outlet_credits[e.id_outlet][
							"total_paid_interest_amount"
						] += e.total_paid_interest_amount;
					} else {
						outlet_credits[e.id_outlet] = {
							id_outlet: e.id_outlet,
							outlet_code: e.outlet_code,
							total_limit: e.total_limit,
							current_balance: e.current_balance,
							paid_amount: e.paid_amount,
							due_amount: e.due_amount,
							total_interest_amount: e.total_interest_amount,
							total_paid_interest_amount:
								e.total_paid_interest_amount
							// fi_name:e.fi_name,
							// fi_logo: process.env.APP_URL + '/public/fi_logos/' + e.fi_logo
						};
					}
				});
			}
			outlet_credits["fi_info"] = fi_info;
			//if(credits ==0) resolve(sendApiResult(false,"Outlet Credits By point Fetch Failed"));

			resolve(
				sendApiResult(true, "Outlet Credit By point", outlet_credits)
			);
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	});
};

exports.scopeOutletsByRoute = function (req) {
	return new Promise(async (resolve, reject) => {
		try {
			const data = await knex("cr_retail_limit")
				.select(
					"cr_retail_limit.id_outlet",
					"cr_retail_limit.outlet_code"
				)
				.leftJoin(
					"retailers",
					"retailers.id",
					"cr_retail_limit.id_outlet"
				)
				.where("retailers.rtid", req.params.id)
				.groupBy("cr_retail_limit.id");

			if (data == 0) reject(sendApiResult(false, "Not found."));

			resolve(sendApiResult(true, "Data fetched successfully", data));
		} catch (error) {
			reject(sendApiResult(false, error.message));
		}
	});
};
