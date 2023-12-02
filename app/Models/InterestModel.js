
const knex = require('../config/database')
const { sendApiResult } = require('../controllers/helperController')

let Interest = function () { }

Interest.insertInterestSettings = function ({ fi_id, outlet_code, interest_percentage, service_charge_percentage, penalty_percentage, created_by }) {
    return new Promise(async (resolve, reject) => {
        try {

            await knex.transaction(async trx => {
                let insert_arr = [];
                for (let i = 0; i < outlet_code.length; i++) {
                    const code = outlet_code[i];
                    const kycDone = await trx("cr_retail_limit").select("id").where({ "outlet_code": code, "kyc_status": "Approved" }).first();
                    if (kycDone) {
                        const existing_dpid = await trx("cr_interest_settings").select("id_point").where("outlet_code", code).first();
                        if (existing_dpid) {
                            const update = await trx("cr_interest_settings").where("outlet_code", code).update({
                                id_fi: fi_id,
                                interest_percentage,
                                service_charge_percentage,
                                penalty_percentage,
                                updated_by: created_by
                            })
                        } else {
                            let temp = {
                                id_fi: fi_id,
                                id_point: (await trx("cr_retail_limit").select("id_point").where("outlet_code", code).first()).id_point,
                                outlet_code: code,
                                interest_percentage,
                                service_charge_percentage,
                                penalty_percentage,
                                created_by
                            };
                            insert_arr.push(temp);
                        }
                    }
                };
                const insert = await trx("cr_interest_settings").insert(insert_arr);
                if (insert == 0) resolve(sendApiResult(false, "Interest Settings Not Inserted"));
                else resolve(sendApiResult(true, "Interest Settings Inserted Successfully"));

                // id
                //const requestedDhIds = await trx("distributorspoint").select("id","dsid").whereIn("id",dpids);
                // id_point
                //const existing_dpids = await trx("cr_interest_settings").select("id_point").whereIn("id_point",dpids).pluck("id_point");
                // id_dh
                //const mappedDhIds = await trx("cr_dh_fi").select("id_dh").where({"id_fi":fi_id, "activation_status": "Active"}).pluck("id_dh");
                //let mapped_dh_dp_obj = [];
                // for (let i = 0; i < requestedDhIds.length; i++) {
                //     const element = requestedDhIds[i];
                //     if (mappedDhIds.indexOf(parseInt(element.id)) !== -1) {
                //         mapped_dh_dp_obj[element.id] = {
                //             dhid: element.dsid
                //         }
                //     }                    
                // }

                // if(dpids.length>0){

                //     dpids.forEach(e => {
                //         //if(existing_dpids.indexOf(parseInt(e)) !== -1 || typeof mapped_dh_dp_obj[e] === 'undefined'){
                //         if(existing_dpids.indexOf(parseInt(e)) !== -1){
                //         }else{
                //             console.log('hi')
                //             let temp = {
                //                 id_fi:fi_id,
                //                 id_point:e,
                //                 interest_percentage,
                //                 service_charge_percentage,
                //                 penalty_percentage,
                //                 created_by
                //             };
                //             insert_arr.push(temp);
                //         }


                //     });
                // }
                // console.log(insert_arr);
                // console.log(existing_dpids);
                // if(existing_dpids.length>0){
                //     const update = await trx("cr_interest_settings").whereIn("id_point",existing_dpids).update({
                //         id_fi:fi_id,
                //         interest_percentage,
                //         service_charge_percentage,
                //         penalty_percentage,
                //         updated_by:created_by
                //     })
                // }

                //  const insert = await trx("cr_interest_settings").insert(insert_arr);
                // if(insert==0)resolve(sendApiResult(false,"Interest Settings Not Inserted"));
                // else resolve(sendApiResult(true,"Interest Settings Inserted Successfully"));
                // resolve(sendApiResult(true,"Interest Settings Inserted Successfully",existing_dpids));
            })
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })

}

Interest.deleteCrLimitConfig = function (id) {
    return new Promise(async (resolve, reject) => {
        try {
            const update = await knex("cr_limit_config")
                .where("id", id).update({ "activation_status": "Inactive" });
            if (update == 0) resolve(sendApiResult(false, "Not found."));
            resolve(sendApiResult(true, "Deleted Successfully", update));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Interest.getUploadedInterestSettings = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const settings = await knex.select(knex.raw(`interest.id as settings_id,
                            interest.id_point,
                            distributorspoint.name as point,
                            interest.id_fi as fi_id,
                            fi.name as fi_name,
                            company.name as dist_house,
                            interest.outlet_code,
                            interest.interest_percentage,
                            interest.service_charge_percentage,
                            interest.penalty_percentage`))
                .from({ interest: "cr_interest_settings" })
                .innerJoin({ fi: "cr_fi_institute" }, "interest.id_fi", "fi.id")
                .innerJoin("distributorspoint", "interest.id_point", "distributorspoint.id")
                .innerJoin("company", "company.id", "distributorspoint.dsid")
                .whereIn("interest.id_point", req.dpids)
                .where(function () {
                    if (req['filterText']) {
                        var search_param = req['filterText'].toLowerCase().replace(/\s/g, '');
                        this.whereRaw(`LOWER(REPLACE(distributorspoint.name, ' ', '')) LIKE '%${search_param}%'`);
                        this.orWhereRaw(`LOWER(REPLACE(company.name, ' ', '')) LIKE '%${search_param}%'`);
                        this.orWhereRaw(`LOWER(REPLACE(fi.name, ' ', '')) LIKE '%${search_param}%'`);
                        this.orWhereRaw(`LOWER(REPLACE(interest.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                    }
                })
                .andWhere("interest.activation_status", "Active")
                .paginate({ perPage: req['per_page'], currentPage: req['current_page'], isLengthAware: true });

            if (settings == 0) resolve(sendApiResult(false, "Could Not get Interest Settings"));
            resolve(sendApiResult(true, "Interest Settings Successfully Fetched", settings));



        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Interest.interestSettingsUpdateByPoint = function (req, res) {
    return new Promise(async (resolve, reject) => {
        try {
            var update;
            const data = await knex.transaction(async trx => {
                update = await trx('cr_interest_settings')
                    .where({ "activation_status": "Active", "id_point": req.params.id })
                    .update(req.body);
            });
            if (update == 0) reject(sendApiResult(false, "Not found."));
            resolve(sendApiResult(true, "Interest settings updated successfully", update));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Interest.interestSettingsDeleteByPoint = function (req, res) {
    return new Promise(async (resolve, reject) => {
        try {
            var delete_data;
            const data = await knex.transaction(async trx => {
                delete_data = await trx('cr_interest_settings')
                    .where({ "activation_status": "Active", "id_point": req.params.id })
                    .update({ "activation_status": "Inactive" });
            });
            if (delete_data == 0) reject(sendApiResult(false, "Not found."));
            resolve(sendApiResult(true, "Interest settings deleted successfully", delete_data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Interest.interestSettingsByPoint = function (req, res) {
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex.from("cr_interest_settings")
                .select("cr_interest_settings.*",
                    knex.raw(`distributorspoint.name as point_name`),
                    knex.raw(`cr_fi_institute.name as fi_name`))
                .leftJoin("distributorspoint", "distributorspoint.id", "cr_interest_settings.id_point")
                .leftJoin("cr_fi_institute", "cr_fi_institute.id", "cr_interest_settings.id_fi")
                .where('cr_interest_settings.id_point', req.params.id)
                .orderBy('id', 'desc').first();
            resolve(sendApiResult(true, "Interest settings fetched successfully", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

module.exports = Interest;