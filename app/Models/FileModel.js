const { sendApiResult, getSettingsValue } = require("../controllers/helperController");
const knex = require('../config/database');
var moment = require('moment');
var express = require('express');
let FileUpload = function () { };

FileUpload.insertScopeOutletBulk = function (rows, filePath, req) {
    return new Promise(async (resolve, reject) => {
        try {
            await knex.transaction(async trx => {
                var obj = [];
                var duplicates = [];
                var outlets = []
                for (let index = 0; index < rows.length; index++) {
                    var array = Object.values(rows[index]);
                    if (!array[1] || array[1] === "") {
                        continue;
                    }
                    outlets.push(array[1])
                }
                var existing_limits = await knex.from("cr_retail_limit")
                    .select("outlet_code")
                    .where("activation_status", "Active")
                    .pluck("outlet_code");
                var retailers = await knex.from("retailers")
                    .where("retailers.stts", 1)
                    .whereIn("retailers.retailer_code", outlets)
                    .leftJoin("distributorspoint", "distributorspoint.id", "retailers.dpid")
                    .select('distributorspoint.dsid', 'retailers.dpid', 'retailers.id', 'retailers.retailer_code');
                var retailers_obj = {}
                for (let i = 0; i < retailers.length; i++) {
                    const element = retailers[i];
                    retailers_obj[element.retailer_code] = {
                        id: element.id,
                        dpid: element.dpid,
                        dhid: element.dsid
                    }
                }
                for (let index = 0; index < rows.length; index++) {
                    var array = Object.values(rows[index]);
                    if (!array[1] || array[1] === "") {
                        continue;
                    }
                    if (existing_limits.includes(array[1])) {
                        duplicates.push(array[1]);
                        continue;
                    }

                    let temp = {
                        outlet_code: array[1],
                        owner_name: array[2],
                        outlet_name: array[3],
                        phone: array[4],
                        address: array[5],
                        id_outlet: (typeof retailers_obj[array[1]] !== 'undefined') ? retailers_obj[array[1]].id : null,
                        id_dh: (typeof retailers_obj[array[1]] !== 'undefined') ? retailers_obj[array[1]].dhid : null,
                        id_point: (typeof retailers_obj[array[1]] !== 'undefined') ? retailers_obj[array[1]].dpid : null,
                        created_by: req.user_id
                    }
                    obj.push(temp);
                }

                if (!obj.length) {
                    resolve(sendApiResult(false, "All Outlets already exists in the system."));
                } else {

                    const insert = await trx.batchInsert("cr_retail_limit", obj, 50);

                    if (insert == 0) reject(sendApiResult(false, "Server Error", insert));

                    let msg = "File uploaded/imported successfully!";

                    if (duplicates.length) {
                        console.log(duplicates.length)
                        msg = "File uploaded/imported but " + duplicates.join(',') + " Outlets are already exists in the system, so these are skipped.";
                    }

                    resolve(sendApiResult(true, msg, insert));
                }
            }).then((result) => {

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

FileUpload.insertBulk = function (rows, filePath, req) {
    return new Promise(async (resolve, reject) => {
        try {
            //console.log(rows);
            var start = moment(req.effective_date, "YYYY-MM-DD");
            var end = moment(new Date(req.duration.split("-")[0], parseInt(req.duration.split("-")[1]), 0), "YYYY-MM-DD");
            var duration = moment.duration(end.diff(start)).asDays();
            await knex.transaction(async trx => {
                if (req.status == 'FI Initiated') {
                    var existing_acc_nos = await knex.from("cr_retail_limit")
                        .select("acc_no")
                        .where("activation_status", "Active")
                        .pluck("outlet_code");
                    for (let i = 0; i < rows.length; i++) {

                        const e = rows[i];
                        var array = Object.values(e);
                        if (!array[1] || array[1] === "") {
                            continue;
                        }
                        /*
                        // Not to update Account Number while Uploading Credit Limit © Muzahid 
                        if (!array[6] || array[6] === "") {
                            resolve(sendApiResult(false,"Account number can not be empty for Outlet Code: " + array[1]));
                            return false;
                        }
                        if (existing_acc_nos.includes(array[6])) {
                            resolve(sendApiResult(false,"Account number already exists for Outlet Code: " + array[1]));
                            return false;
                        }
                        */
                        else {
                            //console.log("-------- Array 6th Element ------------");
                            //console.log( array[6]);
                            existing_acc_nos.push(array[6]);
                        }
                    }
                }
                //console.log(existing_acc_nos);

                var outlets = []
                for (let index = 0; index < rows.length; index++) {
                    var array = Object.values(rows[index]);
                    if (!array[1] || array[1] === "") {
                        continue;
                    }
                    outlets.push(array[1])
                }

                var retailers = await knex.from("retailers")
                    .where("stts", 1)
                    //.whereIn("retailers.retailer_code", outlets)
                    .select('dpid', 'id', 'retailer_code');
                var retailers_obj = {}
                for (let i = 0; i < retailers.length; i++) {
                    const element = retailers[i];
                    retailers_obj[element.retailer_code] = {
                        id: element.id,
                        dpid: element.dpid
                    }
                }

                if (req.status == 'FI Initiated') {
                    var existing_limits = await knex.from("cr_retail_limit")
                        .select("outlet_code")
                        .where("activation_status", "Active")
                        .where('effective_date', req.effective_date)
                        .pluck("outlet_code");
                    for (let index = 0; index < rows.length; index++) {
                        let array = Object.values(rows[index]);
                        if (existing_limits.includes(array[1])) {
                            resolve(sendApiResult(false, "Duplicate Outlet for same Effective Date is not allowed."));
                            return false;
                        }
                    }
                }

                let cr_limit_obj = {
                    id_fi: req.id_fi,
                    title: req.title,
                    status: req.status,
                    note: req.note,
                    created_by: req.created_by
                }
                var id_cr_limit_info;
                if (req.cr_retail_limit_info_id > 0) {
                    id_cr_limit_info = [req.cr_retail_limit_info_id];
                    const update_retail_limit_info_table = await trx("cr_retail_limit_info")
                        .where("id", id_cr_limit_info[0])
                        .update({
                            "status": req.status == 'FI Modified' ? 'Limit confirmed' : req.status
                        });
                } else {
                    id_cr_limit_info = await trx.insert(cr_limit_obj)
                        .into('cr_retail_limit_info');
                }

                const last_cr_retail_limit_log_info = await trx("cr_retail_limit_log")
                    .where("id_cr_limit_info", id_cr_limit_info[0])
                    .orderBy("id", "desc").first();

                delete cr_limit_obj.id_fi;
                delete cr_limit_obj.title;
                cr_limit_obj.file = filePath;
                cr_limit_obj.id_cr_limit_info = id_cr_limit_info[0];

                const cr_retail_limit_log = await trx.insert(cr_limit_obj)
                    .into('cr_retail_limit_log');

                if (id_cr_limit_info == 0) {
                    reject(sendApiResult(false, 'cr_retail_limit_info data not inserted'));
                }
                var obj = [];
                var outlet_codes = [];
                rows.forEach(element => {
                    var array = Object.values(element);
                    if (!array[1] || array[1] === "") {
                        return;
                    }
                    outlet_codes.push(array[1]);
                    let temp = {
                        id_cr_limit_info: id_cr_limit_info[0],
                        id_cr_retail_limit_log: cr_retail_limit_log[0],
                        outlet_code: array[1],
                        owner_name: array[2],
                        outlet_name: array[3],
                        phone: array[4],
                        address: array[5],
                        credit_amount: array[7],
                        // acc_no: array[6],
                        created_by: req.created_by,
                        effective_date: req.effective_date,
                        duration: duration,
                        end_date: moment(req.effective_date).add(duration, 'days').format('YYYY-MM-DD')
                    }
                    obj.push(temp);
                });

                const not_in_existing_logs = await trx("cr_retail_limit_log_details")
                    .whereNotIn("outlet_code", outlet_codes)
                    .where("id_cr_retail_limit_log", typeof last_cr_retail_limit_log_info !== 'undefined' ? last_cr_retail_limit_log_info.id : 0);

                if (req.status != 'FI Initiated') {
                    for (let i = 0; i < not_in_existing_logs.length; i++) {
                        let temp = {
                            id_cr_limit_info: id_cr_limit_info[0],
                            id_cr_retail_limit_log: cr_retail_limit_log[0],
                            outlet_code: not_in_existing_logs[i].outlet_code,
                            owner_name: not_in_existing_logs[i].owner_name,
                            outlet_name: not_in_existing_logs[i].outlet_name,
                            phone: not_in_existing_logs[i].phone,
                            address: not_in_existing_logs[i].address,
                            credit_amount: not_in_existing_logs[i].credit_amount,
                            // acc_no: not_in_existing_logs[i].acc_no,
                            created_by: req.created_by,
                            effective_date: not_in_existing_logs[i].effective_date,
                            duration: not_in_existing_logs[i].duration,
                            end_date: not_in_existing_logs[i].end_date
                        }
                        obj.push(temp);
                    }
                }


                const log_insert = await trx.batchInsert("cr_retail_limit_log_details", obj, 50);
                if (req.status == 'FI Initiated') {
                    const update_retail_limit_table = await trx("cr_retail_limit")
                        .whereIn("outlet_code", outlet_codes)
                        .whereNull("id_cr_limit_info")
                        .update({
                            "id_cr_limit_info": id_cr_limit_info[0],
                            "limit_status": "FI Initiated"
                        });
                } else {
                    var limit_status;
                    if (req.status == 'BAT Modified') {
                        limit_status = 'BAT Approve / Modified';
                    }
                    if (req.status == 'FI Modified') {
                        limit_status = 'FI Confirmed';
                    }

                    const update_retail_limit_table = await trx("cr_retail_limit")
                        .where("id_cr_limit_info", id_cr_limit_info[0])
                        .update({
                            "id_cr_limit_info": id_cr_limit_info[0],
                            "limit_status": limit_status
                        });
                }
                var limit_confirmed_obj = [];
                if (req.status == 'Limit confirmed' || req.status == 'FI Modified') {
                    let config_details = await trx.from("cr_limit_config")
                        .select('allowed_percentage', 'daily_percentage', 'id_point')
                        .where("activation_status", "Active");
                    var config_details_obj = {};
                    for (let i = 0; i < config_details.length; i++) {
                        const element = config_details[i];
                        config_details_obj[element.id_point] = {
                            allowed_percentage: element.allowed_percentage,
                            daily_percentage: element.daily_percentage
                        }
                    }
                    for (let index = 0; index < rows.length; index++) {
                        let array = Object.values(rows[index]);
                        if (!array[1] || array[1] === "") {
                            continue;
                        }
                        let allowed_percentage = parseFloat(await getSettingsValue('allowed_percentage', 'scope_upload'));
                        let daily_percentage = parseFloat(await getSettingsValue('daily_percentage', 'scope_upload'));
                        if (typeof retailers_obj[array[1]] !== 'undefined') {
                            allowed_percentage = typeof (config_details_obj[retailers_obj[array[1]].dpid]) !== 'undefined' ? config_details_obj[retailers_obj[array[1]].dpid].allowed_percentage : allowed_percentage;
                            daily_percentage = typeof (config_details_obj[retailers_obj[array[1]].dpid]) !== 'undefined' ? config_details_obj[retailers_obj[array[1]].dpid].daily_percentage : daily_percentage;
                        }

                        let credit_amount = parseFloat(array[7]);
                        let allowed_limit = (credit_amount * allowed_percentage) / 100;
                        let daily_limit = (allowed_limit * daily_percentage) / 100;
                        let current_balance = allowed_limit;

                        let temp = {
                            id_cr_limit_info: id_cr_limit_info[0],
                            outlet_code: array[1],
                            owner_name: array[2],
                            outlet_name: array[3],
                            phone: array[4],
                            address: array[5],
                            credit_amount: credit_amount,
                            allowed_limit: allowed_limit,
                            current_balance: current_balance,
                            daily_limit: daily_limit,
                            // acc_no: array[6],
                            created_by: req.created_by,
                            effective_date: req.effective_date,
                            duration: duration,
                            id_outlet: typeof retailers_obj[array[1]] !== 'undefined' ? retailers_obj[array[1]].id : null,
                            id_point: typeof retailers_obj[array[1]] !== 'undefined' ? retailers_obj[array[1]].dpid : null,
                            end_date: moment(req.effective_date).add(duration, 'days').format('YYYY-MM-DD'),
                            kyc_status: "Approved"
                        }

                        let retail_limit_update = await trx("cr_retail_limit")
                            .where("id_cr_limit_info", id_cr_limit_info[0])
                            .where("id_outlet", retailers_obj[array[1]].id).update(temp);
                        //limit_confirmed_obj.push(temp);

                    }
                    for (let i = 0; i < not_in_existing_logs.length; i++) {
                        let allowed_percentage = parseFloat(await getSettingsValue('allowed_percentage', 'scope_upload'));
                        let daily_percentage = parseFloat(await getSettingsValue('daily_percentage', 'scope_upload'));
                        if (typeof retailers_obj[not_in_existing_logs[i].outlet_code] !== 'undefined') {
                            ;
                            allowed_percentage = typeof (config_details_obj[retailers_obj[not_in_existing_logs[i].outlet_code].dpid]) !== 'undefined' ? config_details_obj[retailers_obj[not_in_existing_logs[i].outlet_code].dpid].allowed_percentage : allowed_percentage;
                            daily_percentage = typeof (config_details_obj[retailers_obj[not_in_existing_logs[i].outlet_code].dpid]) !== 'undefined' ? config_details_obj[retailers_obj[not_in_existing_logs[i].outlet_code].dpid].daily_percentage : daily_percentage;
                        }

                        let credit_amount = parseFloat(not_in_existing_logs[i].credit_amount);
                        let allowed_limit = (credit_amount * allowed_percentage) / 100;
                        let daily_limit = (allowed_limit * daily_percentage) / 100;
                        let current_balance = allowed_limit;

                        let temp2 = {
                            id_cr_limit_info: id_cr_limit_info[0],
                            outlet_code: not_in_existing_logs[i].outlet_code,
                            owner_name: not_in_existing_logs[i].owner_name,
                            outlet_name: not_in_existing_logs[i].outlet_name,
                            phone: not_in_existing_logs[i].phone,
                            address: not_in_existing_logs[i].address,
                            credit_amount: credit_amount,
                            allowed_limit: allowed_limit,
                            daily_limit: daily_limit,
                            current_balance: current_balance,
                            // acc_no: not_in_existing_logs[i].acc_no,
                            created_by: req.created_by,
                            effective_date: not_in_existing_logs[i].effective_date,
                            duration: not_in_existing_logs[i].duration,
                            id_outlet: (typeof retailers_obj[not_in_existing_logs[i].outlet_code] !== 'undefined') ? retailers_obj[not_in_existing_logs[i].outlet_code].id : null,
                            id_point: (typeof retailers_obj[not_in_existing_logs[i].outlet_code] !== 'undefined') ? retailers_obj[not_in_existing_logs[i].outlet_code].dpid : null,
                            end_date: moment(not_in_existing_logs[i].effective_date).add(not_in_existing_logs[i].duration, 'days').format('YYYY-MM-DD'),
                            kyc_status: "Approved"
                        }
                        console.log(retailers_obj[not_in_existing_logs[i].outlet_code])
                        let retail_limit_update = await trx("cr_retail_limit")
                            .where("id_cr_limit_info", id_cr_limit_info[0])
                            .where("id_outlet", retailers_obj[not_in_existing_logs[i].outlet_code].id).update(temp2);
                    }
                    //const retail_limit_insert = await trx.batchInsert("cr_retail_limit",limit_confirmed_obj, 50);
                }
                resolve(sendApiResult(true, "File uploaded/imported successfully!", log_insert));

            }).then((result) => {

            }).catch((error) => {
                reject(sendApiResult(false, "Duplicate Outlet for same Effective Date is not allowed."));
                console.log(error.message)
            });

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    }).catch((error) => {
        console.log(error.message);
    });
}

FileUpload.insertBulkKYCApprove = function (rows, filePath, req) {

    return new Promise(async (resolve, reject) => {
        try {
            await knex.transaction(async trx => {
                var msg;
                if (Object.keys(rows).length == 0) {
                    resolve(sendApiResult(false, "No Rows Found in your Uploaded File."));
                }

                var obj = [];
                var duplicates = [];
                var outlets = []
                for (let index = 0; index < rows.length; index++) {
                    var array = Object.values(rows[index]);
                    if (!array[1] || array[1] === "") {
                        continue;
                    }
                    outlets.push(array[1]);
                }

                var outlet_list = await knex.from("cr_retail_limit")
                    .select("outlet_code")
                    .where("kyc_status", "Pending")
                    .whereIn("outlet_code", outlets);

                if (Object.keys(outlet_list).length != 0) {

                    const insert_log = {
                        'sys_date': moment(new Date()).format('YYYY-MM-DD'),
                        'file_path': process.env.PUBLIC_URL + 'kyc_bulk_upload/',
                        'file_name': filePath,
                        'found_rows': Object.keys(rows).length,
                        'update_rows': Object.keys(outlet_list).length,
                        'created_by': req.user_id
                    }
                    const insert = await knex("cr_bulk_kyc_update_upload_log").insert(insert_log).returning('id');
                    var last_insert_id = insert[0];

                    const kyc_status_update = await knex("cr_retail_limit")
                        .where("kyc_status", "Pending")
                        .whereIn("outlet_code", outlets)
                        .update({
                            'kyc_status': 'Approved',
                            'bulk_kyc_status_update_id': last_insert_id
                        });

                    if (kyc_status_update) {
                        msg = "File Uploaded successfully!";
                    } else {
                        reject(sendApiResult(false, "File Uploaded Error", insert));
                    }

                    resolve(sendApiResult(true, msg, insert));
                } else {
                    msg = "No outlet Founds to Update";
                    resolve(sendApiResult(true, msg));
                }

            }).then((result) => {

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

FileUpload.insertOutletDetailsInfo = function (rows, filePath, req) {

    return new Promise(async (resolve, reject) => {
        try {
            await knex.transaction(async trx => {
                var msg;
                if (Object.keys(rows).length == 0) {
                    resolve(sendApiResult(false, "No Rows Found in your Uploaded File."));
                }

                var obj = [];
                var duplicates = [];
                var outlets = [];
                for (let index = 0; index < rows.length; index++) {
                    var array = Object.values(rows[index]);
                    if (!array[1] || array[1] === "") {
                        continue;
                    }
                    outlets.push(array[0]);
                }

                var outlet_list = await knex.from("cr_retail_additional_info")
                    .select("retailer_code")
                    .where("status", "0")
                    .whereIn("retailer_code", outlets);

                if (Object.keys(rows).length != 0) {
                    var insert_data = [];
                    var outlets = {};
                    for (let index = 0; index < rows.length; index++) {
                        var retailer_code = rows[index].Retailer_Code;
                        if (outlets.toString().indexOf(retailer_code) == -1) {
                            const temp_data = {
                                'retailer_code': rows[index].Retailer_Code,
                                'branch': rows[index].Branch,
                                'title': rows[index].Title,
                                'name': rows[index].Name,
                                'father_title': rows[index].Fathers_Title,
                                'father_name': rows[index].Fathers_Name,
                                'mother_title': rows[index].Mothers_Title,
                                'mother_name': rows[index].Mothers_Name,
                                'spouse_title': rows[index].Spouse_Title,
                                'spouse_name': rows[index].Spouse_Name,
                                'gender': rows[index].Gender,
                                'dob': rows[index].Date_of_Birth,
                                'birth_district': rows[index].Birth_District,
                                'birth_country': rows[index].Birth_Country,
                                '17_digit_nid': rows[index]._17_Digit_NID,
                                '10_digit_nid': rows[index]._10_Digit_NID,
                                'tin_number': rows[index].TIN_Number,
                                'parmanent_address': rows[index].Parmanent_Address,
                                'parmanent_address_post_code': rows[index].Parmanent_Address_Post_Code,
                                'parmanent_address_district': rows[index].Parmanent_Address_District,
                                'country_of_permanent_address': rows[index].Country_of_Permanent_Address,
                                'business_address': rows[index].Business_Address,
                                'business_address_code': rows[index].Business_Address_Code,
                                'business_address_district': rows[index].Business_Address_District,
                                'country_of_Business': rows[index].Country_of_Business,
                                'phone': rows[index].Phone,
                                'status': 1
                            }
                            insert_data.push(temp_data);
                        }
                    }
                    if (Object.keys(insert_data).length != 0) {
                        const insert = await knex("cr_retail_additional_info").insert(insert_data);
                        if (insert) {
                            const insert_log = {
                                'sys_date': moment(new Date()).format('YYYY-MM-DD'),
                                'file_path': process.env.PUBLIC_URL + 'outlet_documents/outlet_nid_info/',
                                'file_name': filePath,
                                'found_rows': Object.keys(rows).length,
                                'upload_rows': Object.keys(insert_data).length,
                                'created_by': req.user_id
                            }
                            await knex("cr_retail_additional_info_upload_log").insert(insert_log);
                            msg = "File Uploaded successfully!";
                        } else {
                            reject(sendApiResult(false, "File Uploaded Error", insert));
                        }
                        resolve(sendApiResult(true, msg, insert));
                    } else {
                        reject(sendApiResult(false, "Oops! All Retailer Code Exists!"));
                    }
                } else {
                    msg = "No outlet Founds to Update";
                    resolve(sendApiResult(true, msg));
                }
            }).then((result) => {
                //  
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

FileUpload.insertInterestSettingsBulk = function (rows, filePath, req) {
    return new Promise(async (resolve, reject) => {
        try {
            await knex.transaction(async trx => {
                let insert_arr = [];
                for (let i = 0; i < rows.length; i++) {
                    const code = rows[i].outlet_code;
                    const kycDone = await trx("cr_retail_limit").select("id").where({ "outlet_code": code, "kyc_status": "Approved" }).first();
                    console.log(kycDone);
                    if (kycDone) {
                        const existing_dpid = await trx("cr_interest_settings").select("id_point").where("outlet_code", code).first();
                        if (existing_dpid) {
                            const update = await trx("cr_interest_settings").where("outlet_code", code).update({
                                id_fi: req.fi_id,
                                interest_percentage: rows[i].interest_percentage,
                                service_charge_percentage: rows[i].service_charge_percentage,
                                penalty_percentage: rows[i].penalty_percentage,
                                updated_by: req.user_id
                            })
                        } else {
                            let temp = {
                                id_fi: req.fi_id,
                                id_point: (await trx("cr_retail_limit").select("id_point").where("outlet_code", code).first()).id_point,
                                outlet_code: code,
                                interest_percentage: rows[i].interest_percentage,
                                service_charge_percentage: rows[i].service_charge_percentage,
                                penalty_percentage: rows[i].penalty_percentage,
                                created_by: req.user_id
                            };
                            insert_arr.push(temp);
                        }
                    }
                };
                if (insert_arr.length > 0) {
                    const insert = await trx.batchInsert("cr_interest_settings", insert_arr, 50);
                    if (insert == 0) resolve(sendApiResult(false, "Interest Settings Not Inserted"));
                }
                else resolve(sendApiResult(true, "Interest Settings Inserted Successfully"));

                //resolve(sendApiResult(true, "File uploaded/imported successfully!", log_insert));
            }).then((result) => {

            }).catch((error) => {
                reject(sendApiResult(false, "Interest Settings Not Inserted"));
                console.log(error.message)
            });

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    }).catch((error) => {
        console.log(error.message);
    });
}

FileUpload.retailerPhoneNumberChangeBulk = function (rows, filePath, req) {
    return new Promise(async (resolve, reject) => {
        try {
            await knex.transaction(async trx => {

                console.log("phone otp start");
                let insert_arr = [];
                for (let i = 0; i < rows.length; i++) {
                    const retailer = rows[i];
                    const outletCode = await knex("cr_retail_limit").select("outlet_code").where("outlet_code", retailer.outlet_code).first();

                    if (outletCode === undefined) {
                        return resolve(sendApiResult(false, `Code: ${retailer.outlet_code} is not exist on recode`));
                    }
                    if (retailer.phone_number.length != 11) {
                        return resolve(sendApiResult(false, `Code: ${retailer.outlet_code}. Phone number is not valid`));
                    }
                }
                for (let i = 0; i < rows.length; i++) {
                    const code = rows[i].outlet_code;
                    const phoneNumber = rows[i].phone_number;

                    const update = await knex("cr_retail_limit").where("outlet_code", code).update({
                        phone: phoneNumber
                    })
                }
                insertChangeLog = await knex("cr_retailer_phone_number_change_log").insert({
                    changed_by: req.user_id,
                    change_type: 'bulk',
                    file_path: `retailer_phone_number_change/${filePath}`,
                });

                console.log("phone otp end");
                resolve(sendApiResult(true, "File uploaded/imported successfully!"));

            }).catch((error) => {
                reject(sendApiResult(false, "Retailer phone number change Not Inserted"));
                // console.log(error.message)
            });

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    }).catch((error) => {
        console.log(error.message);
    });
}


module.exports = FileUpload