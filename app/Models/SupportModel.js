const knex = require('../config/database')
const { sendApiResult } = require('../controllers/helperController');
var moment = require('moment');

let Support = function () { }

Support.supportOutletList = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const outletList = await knex("cr_retail_limit")
                                .select(
									"cr_retail_limit.id AS retail_limit_id",
									"cr_retail_limit.id_outlet",
									"cr_retail_limit.outlet_name",
									"cr_retail_limit.outlet_code",
									"cr_retail_limit.owner_name",
									"cr_retail_limit.phone",
									"cr_retail_limit.credit_amount",
									"cr_retail_limit.allowed_limit",
									"cr_retail_limit.daily_limit",
									"cr_retail_limit.current_balance",
									"cr_retail_limit.total_due",
									"cr_retail_limit.minimum_due",
									"cr_retail_limit.carry_amount",
									"cr_retail_limit.kyc_status AS kyc_status",
									"cr_retail_limit.activation_status AS status"									
                                )
								.whereIn("cr_retail_limit.id_point", [334, 344])
								.whereIn("cr_retail_limit.id_dh", [57])
                                .orderBy("cr_retail_limit.outlet_code");
								            
            resolve(sendApiResult(true,"Support Outlet List Fetched Successfully",outletList));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Support.supportCreditOutletList = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const outletList = await knex("cr_retail_limit")
                                .select(
									"cr_retail_limit.outlet_name",
									"cr_retail_limit.outlet_code",
									"cr_retail_limit.owner_name",
									"cr_retail_limit.phone",
									"cr_retail_limit.credit_amount",
									"cr_retail_limit.allowed_limit",
									"cr_retail_limit.daily_limit",
									"cr_retail_limit.current_balance",
									"cr_retail_limit.total_due",
									"cr_retail_limit.minimum_due",
									"cr_retail_limit.carry_amount",
									"cr_retail_limit.limit_status AS limit_status",
									"cr_retail_limit.kyc_status AS kyc_status",
									"cr_retail_limit.activation_status AS status"
                                )
								.whereNotIn("cr_retail_limit.id_point", [334, 344])
								.whereNotIn("cr_retail_limit.id_dh", [57])
                                .orderBy("cr_retail_limit.outlet_code");
								            
            resolve(sendApiResult(true,"Credit Outlet List Fetched Successfully",outletList));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Support.updateOutletInfo = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const update_outlet_status = await knex("cr_retail_limit")
													.where("cr_retail_limit.id_outlet", req.id_outlet)
													.whereIn("cr_retail_limit.id_point", [334, 344])
													.whereIn("cr_retail_limit.id_dh", [57])
													.update({
														'cr_retail_limit.phone': req.phone,
														'cr_retail_limit.activation_status': req.status,
														'cr_retail_limit.minimum_due': parseFloat(req.minimum_due).toFixed(2),
														'cr_retail_limit.total_due': parseFloat(req.total_due).toFixed(2),
														'cr_retail_limit.kyc_status': req.kyc_status
													});
			if(update_outlet_status == true){
				resolve(sendApiResult(true, "Support Outlet Info Update Successfully"));
			} else {
				resolve(sendApiResult(true, "Support Outlet Info Update Failed!"));
			}
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Support.deleteOutletDisbursement = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
			var today =  moment(new Date()).format('YYYY-M-DD');
			var delete_disbursement = await knex("cr_credit_disbursements")
										.where("id_outlet",req.id_outlet)
										// .where("sys_date",today)
										.delete();
			
			if(delete_disbursement == true){
				resolve(sendApiResult(true, "Support Outlet Disbursement Deleted Successfully"));
			} else {
				resolve(sendApiResult(true, "Support Outlet Disbursement Deleted Failed!"));
			}
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Support.deleteOutletPayment = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
			var today =  moment(new Date()).format('YYYY-M-DD');
            var delete_payment = await knex("cr_credit_payments")
										.where("id_outlet",req.id_outlet)
										// .where("sys_date",today)
										.delete();
			if(delete_payment == true){
				resolve(sendApiResult(true, "Support Outlet Payment Deleted Successfully"));
			} else {
				resolve(sendApiResult(true, "Support Outlet Payment Deleted Failed!"));
			}
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Support.OtpCheckLog = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
			var today =  moment(new Date()).format('YYYY-MM-DD');
            const OtpLog = await knex("cr_otp_log")
							.select(
								"distributorspoint.name AS dp_name",
								"cr_otp_log.user_id",
								"cr_otp_log.outlet_code",
								"retailers.name AS outlet_name",
								"cr_otp_log.task",
								"cr_otp_log.mobile_no",
								"cr_otp_log.otp",
								"cr_otp_log.msg_body",
								"cr_otp_log.otp_status",
								knex.raw(`DATE_FORMAT(cr_otp_log.created, "%h:%i:%s %p") AS request_time`),
								knex.raw(`DATE_FORMAT(cr_otp_log.updated, "%h:%i:%s %p") AS send_time`)
							)
							.leftJoin("retailers", "retailers.id", "cr_otp_log.id_outlet")
							.innerJoin("distributorspoint", "retailers.dpid", "distributorspoint.id")
							.where("cr_otp_log.sys_date", today)
							//.where("retailers.stts", 1)
							.orderBy("cr_otp_log.id", "DESC")
							.limit(500);
								            
            resolve(sendApiResult(true,"Support OTP Check Log Fetched Successfully", OtpLog));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Support.OtpLogUpdate = async function (req) {
	console.log(req);
    return new Promise(async (resolve, reject) => {
        try {
			const insert = await knex("cr_otp_log")
				           .insert({
							"sys_date" : req.sys_date,
							"user_id" : req.user_id,
							"id_outlet" : req.outlet_id,
							"outlet_code" : req.outlet_code,
							"task" : req.task,
							"mobile_no" : req.phone,
							"sms_via" : req.sms_via,
							"otp" : req.otp,
							"msg_body" : req.msg_body,
							"otp_status" : req.status
						});			            
            resolve(sendApiResult(true,"Successfully Submitted!"));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}


module.exports = Support;