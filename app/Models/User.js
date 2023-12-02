const { sendApiResult } = require("../controllers/helperController");
const knex = require('../config/database');
const md5 = require('md5')

let User = function () { };
User.getLocationBasedOnPermission = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            //resolve(sendApiResult(true,"Location Fetched Successfully"));
            let user_id = req.user_id;
            var dpids;
            /*if (req.user_type == 'fi') {
                const id_dhs = await knex("cr_dh_fi")
                    .select("id_dh")
                    .where({
                        id_fi: req.fi_id,
                        activation_status: "Active"
                    })
                    .pluck('id_dh');

                dpids = await knex("distributorspoint")
                    .select("id")
                    .whereIn("dsid", id_dhs)
                    .pluck('id');

            } else if (req.user_type == 'superadmin') {
                const dh_id = await knex('company')
                    .select("id")
                    .where("stts", 1)
                    .where("sales_type", "BAT")
                    .pluck("id");
                dpids = await knex("distributorspoint")
                    .select("id")
                    .whereIn("dsid", dh_id)
                    .where("stts", 1)
                    .pluck('id');
            } else if (req.user_type == 'admin') {
                const dh_id = await knex('cr_dh_user')
                    .select("dh_id")
                    .where("cr_user_id", user_id)
                    .pluck("dh_id");
                dpids = await knex("distributorspoint")
                    .select("id")
                    .whereIn("dsid", dh_id)
                    .pluck('id');
            } else {
                const dh_id = await knex('cr_dh_user')
                    .select("dh_id")
                    .where("cr_user_id", user_id)
                    .pluck("dh_id");
                dpids = await knex("distributorspoint")
                    .select("id")
                    .whereIn("dsid", dh_id)
                    .pluck('id');
            }*/
			// if (req.user_type == 'fi' || req.user_type == 'admin'  || req.user_type == 'superadmin' ) {
			if (req.user_type == 'fi' || req.user_type == 'superadmin' ) {
                const id_dhs = await knex("cr_dh_fi")
                    .select("id_dh")
                    .where({
                        id_fi: req.fi_id,
                        activation_status: "Active"
                    })
                    .pluck('id_dh');
    
                dpids = await knex("distributorspoint")
                    .select("id")
                    .whereIn("dsid", id_dhs)
                    .pluck('id');
			} else {
				const dh_id = await knex('cr_dh_user')
					.select("dh_id")
					.where("cr_user_id", user_id)
					.pluck("dh_id");
				dpids = await knex("distributorspoint")
					.select("id")
					.whereIn("dsid", dh_id)
					.pluck('id');
			}
            console.log(dpids)
            const dsids = await knex("distributorspoint").distinct("dsid").whereIn("id", dpids).pluck("dsid");
            const regions = await knex.select(knex.raw(`DISTINCT _locations.id, _locations.slug`))
                .from("_locations")
                .innerJoin("distributorspoint", "distributorspoint.region", "_locations.id")
                .whereRaw("_locations.ltype = 7 AND _locations.stts = 1")
                .whereIn("distributorspoint.id", dpids);
            const area = await knex.select(knex.raw(`DISTINCT _locations.id, _locations.slug, _locations.parent AS region `))
                .from("_locations")
                .innerJoin("distributorspoint", "distributorspoint.area", "_locations.id")
                .whereRaw("_locations.ltype = 8 AND _locations.stts = 1")
                .whereIn("distributorspoint.id", dpids);
            const companies = await knex.select(knex.raw(`company.region, company.area, company.id, company.name`))
                .from("company")
                .whereIn("company.id", dsids)
				.where("sales_type", "BAT");

            const territory = await knex.select(knex.raw(`company_territory.dsid as company, company_territory.territory as id, company_territory.name`))
                .from("company_territory")
                .innerJoin("distributorspoint", "company_territory.territory", "distributorspoint.territory")
                .whereIn("company_territory.dsid", dsids)
                .whereIn("distributorspoint.id", dpids)
                .groupBy("company_territory.dsid", "company_territory.territory");
            const points = await knex.select(knex.raw(`distributorspoint.dsid, distributorspoint.region, distributorspoint.area, distributorspoint.territory, distributorspoint.id, distributorspoint.name`))
                .from("distributorspoint")
                .whereIn("distributorspoint.id", dpids);
			/*
            const outlets = await knex.select(knex.raw(`cr_retail_limit.id, cr_retail_limit.id_point, cr_retail_limit.outlet_code`))
                .from("cr_retail_limit")
                .whereIn("cr_retail_limit.id_point", dpids);
			*/
            const phases = await knex.select(knex.raw(`cr_retail_phase.id, cr_retail_phase.name, cr_retail_phase.leaderboard_status, cr_retail_phase.status`))
                .from("cr_retail_phase");

            let data = {
                "regions": regions,
                "areas": area,
                "territory": territory,
                "companies": companies,
                "points": points,
                // "outlets": outlets,
                "phases": phases
            }
            resolve(sendApiResult(true, "Location Fetched Successfully", data));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

User.getOutletByPoint = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            dpids = req.dpids;
            const outlets = await knex.select("cr_retail_limit.id_outlet", "cr_retail_limit.outlet_code", knex.raw(`concat(routes.number, section_days.slug) as route_section`))
                .join("retailers", "retailers.id", "cr_retail_limit.id_outlet")
                .join("routes", "routes.id", "retailers.rtid")
                .join("section_days", "routes.section", "section_days.section")
                .from("cr_retail_limit")
                .where("routes.stts", 1)
                .whereIn("cr_retail_limit.id_point", dpids);

            let data = {
                "outlets": outlets
            }
            resolve(sendApiResult(true, "Outlet Fetched Successfully", data));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

User.getLocationBasedOnPermissionForReport = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            //resolve(sendApiResult(true,"Location Fetched Successfully"));
            let user_id = req.user_id;
            var dpids;
            /*if (req.user_type == 'fi') {
                const id_dhs = await knex("cr_dh_fi")
                    .select("id_dh")
                    .where({
                        id_fi: req.fi_id,
                        activation_status: "Active"
                    })
                    .pluck('id_dh');

                dpids = await knex("distributorspoint")
                    .select("id")
                    .whereIn("dsid", id_dhs)
                    .pluck('id');

            } 
			else if (req.user_type == 'superadmin') {
                const dh_id = await knex('company')
                    .select("id")
                    .where("stts", 1)
                    .where("sales_type", "BAT")
                    .pluck("id");
                dpids = await knex("distributorspoint")
                    .select("id")
                    .whereIn("dsid", dh_id)
                    .where("stts", 1)
                    .pluck('id');
            }
			else if (req.user_type == 'admin') {
                const dh_id = await knex('company')
                    .select("id")
                    .where("stts", 1)
                    .pluck("id");
                dpids = await knex("distributorspoint")
                    .select("id")
                    .whereIn("dsid", dh_id)
                    .where("stts", 1)
                    .pluck('id');
            } else {
                const dh_id = await knex('cr_dh_user')
                    .select("dh_id")
                    .where("cr_user_id", user_id)
                    .pluck("dh_id");
                dpids = await knex("distributorspoint")
                    .select("id")
                    .whereIn("dsid", dh_id)
                    .pluck('id');
            }*/
			// if (req.user_type == 'fi' || req.user_type == 'admin'  || req.user_type == 'superadmin' ) {
			if (req.user_type == 'fi' || req.user_type == 'superadmin' ) {
                const id_dhs = await knex("cr_dh_fi")
                    .select("id_dh")
                    .where({
                        id_fi: req.fi_id,
                        activation_status: "Active"
                    })
                    .pluck('id_dh');
    
                dpids = await knex("distributorspoint")
                    .select("id")
                    .whereIn("dsid", id_dhs)
                    .pluck('id');
			} else {
				const dh_id = await knex('cr_dh_user')
					.select("dh_id")
					.where("cr_user_id", user_id)
					.pluck("dh_id");
				dpids = await knex("distributorspoint")
					.select("id")
					.whereIn("dsid", dh_id)
					.pluck('id');
			}
            console.log(dpids)
            const dsids = await knex("distributorspoint").distinct("dsid").whereIn("id", dpids).pluck("dsid");
            const regions = await knex.select(knex.raw(`DISTINCT _locations.id, _locations.slug`))
                .from("_locations")
                .innerJoin("distributorspoint", "distributorspoint.region", "_locations.id")
                .whereRaw("_locations.ltype = 7 AND _locations.stts = 1")
                .whereIn("distributorspoint.id", dpids);
            const area = await knex.select(knex.raw(`DISTINCT _locations.id, _locations.slug, _locations.parent AS region `))
                .from("_locations")
                .innerJoin("distributorspoint", "distributorspoint.area", "_locations.id")
                .whereRaw("_locations.ltype = 8 AND _locations.stts = 1")
                .whereIn("distributorspoint.id", dpids);
            const companies = await knex.select(knex.raw(`company.region, company.area, company.id, company.name`))
                .from("company")
                .whereIn("company.id", dsids)

            const territory = await knex.select(knex.raw(`company_territory.dsid as company, company_territory.territory as id, company_territory.name`))
                .from("company_territory")
                .innerJoin("distributorspoint", "company_territory.territory", "distributorspoint.territory")
                .whereIn("company_territory.dsid", dsids)
                .whereIn("distributorspoint.id", dpids)
                .groupBy("company_territory.dsid", "company_territory.territory");
            const points = await knex.select(knex.raw(`distributorspoint.dsid, distributorspoint.region, distributorspoint.area, distributorspoint.territory, distributorspoint.id, distributorspoint.name`))
                .from("distributorspoint")
                .whereIn("distributorspoint.id", dpids);

            const routes_sections = await knex.select(knex.raw(`concat(routes.number, section_days.slug) as route_section`))
                .join("section_days", "routes.section", "section_days.section")
                .from("routes")
                .where("stts", 1)
                .whereIn("routes.dpid", dpids);

            const outlets = await knex.select("cr_retail_limit.id_outlet", "cr_retail_limit.outlet_code", knex.raw(`concat(routes.number, section_days.slug) as route_section`))
                .join("retailers", "retailers.id", "cr_retail_limit.id_outlet")
                .join("routes", "routes.id", "retailers.rtid")
                .join("section_days", "routes.section", "section_days.section")
                .from("cr_retail_limit")
                .where("routes.stts", 1)
                .whereIn("cr_retail_limit.id_point", dpids);

            let data = {
                "regions": regions,
                "areas": area,
                "territory": territory,
                "companies": companies,
                "points": points,
                "routes_sections": routes_sections,
                "outlets": outlets
            }
            resolve(sendApiResult(true, "Location Fetched Successfully", data));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

User.getLocationsFiDiWise = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            //resolve(sendApiResult(true,"Location Fetched Successfully"));
            let user_id = req.user_id;
            var dpids;
            //if (req.user_type == 'fi') {
                const id_dhs = await knex("cr_dh_fi")
                    .select("id_dh")
                    .where({
                        id_fi: req.fi_id,
                        activation_status: "Active"
                    })
                    .pluck('id_dh');

                dpids = await knex("distributorspoint")
                    .select("id")
                    .whereIn("dsid", id_dhs)
                    .pluck('id');

            /*} else {
                dpids = await knex("hrs_distributorpoint")
                    .select("ho_dpid")
                    .where({
                        ho_hrsid: user_id,
                        ho_status: 1
                    })
                    .pluck('ho_dpid');
            }*/
            const dsids = await knex("distributorspoint").distinct("dsid").whereIn("id", dpids).pluck("dsid");
            const regions = await knex.select(knex.raw(`DISTINCT _locations.id, _locations.slug`))
                .from("_locations")
                .innerJoin("distributorspoint", "distributorspoint.region", "_locations.id")
                .whereRaw("_locations.ltype = 7 AND _locations.stts = 1")
                .whereIn("distributorspoint.id", dpids);
            const area = await knex.select(knex.raw(`DISTINCT _locations.id, _locations.slug, _locations.parent AS region `))
                .from("_locations")
                .innerJoin("distributorspoint", "distributorspoint.area", "_locations.id")
                .whereRaw("_locations.ltype = 8 AND _locations.stts = 1")
                .whereIn("distributorspoint.id", dpids);
            const companies = await knex.select(knex.raw(`company.region, company.area, company.id, company.name`))
                .from("company")
                .whereIn("company.id", dsids);

            const territory = await knex.select(knex.raw(`company_territory.dsid as company, company_territory.territory as id, company_territory.name`))
                .from("company_territory")
                .innerJoin("distributorspoint", "company_territory.territory", "distributorspoint.territory")
                .whereIn("company_territory.dsid", dsids)
                .whereIn("distributorspoint.id", dpids)
                .groupBy("company_territory.dsid", "company_territory.territory");
            const points = await knex.select(knex.raw(`distributorspoint.dsid, distributorspoint.region, distributorspoint.area, distributorspoint.territory, distributorspoint.id, distributorspoint.name`))
                .from("distributorspoint")
                .whereIn("distributorspoint.id", dpids);

            let data = {
                "regions": regions,
                "areas": area,
                "territory": territory,
                "companies": companies,
                "points": points
            }
            resolve(sendApiResult(true, "Location Fetched Successfully", data));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

User.getUserById = (id) => {
    return new Promise(async (resolve, reject) => {
        try {
            const user = await knex("cr_users")
                .where({
                    "id": id
                }).first();
            resolve(sendApiResult(true, "User info Fetched successfully.", user));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

User.changePass = (req) => {
    console.log(req)
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex('cr_users')
                .where({ 'id': req.body.user_id })
                .first()
                .catch((err) => {
                    reject(sendApiResult(false, err.message));
                }
                );
            if (!data || !(md5("++" + req.body.curr_pass + "--") == data.password)) {
                reject(sendApiResult(false, "Current Password Mismatch."));
            } else {
                const update = await knex("cr_users")
                    .where({ 'id': req.body.user_id })
                    .update({
                        password: md5("++" + req.body.new_pass + "--")
                    });
                if (update == 0) {
                    reject(sendApiResult(false, "Data not updated."));
                } else {
                    resolve(sendApiResult(true, "Password Updated."));
                }
            }
        } catch (error) {
            console.log(error)
            reject(sendApiResult(false, error.message));
        }
    });
}

User.createUser = (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            const count = await knex('cr_users')
                .where({ 'email': req.email })
                .count({ total: '*' }).first();
            if (count.total > 0) {
                reject(sendApiResult(false, "Email already exists."));
            } else {
                const insert = await knex("cr_users")
                    .insert({
                        name: req.name,
                        email: req.email,
                        phone: req.phone,
                        //created_by: req.created_by,
                        cr_user_type: req.cr_user_type,
                        id_fi: req.cr_user_type == 'fi' ? req.id_fi : null,
                        remarks: req.remarks != undefined ? req.remarks : null,
                        password: md5("++" + req.password + "--")
                    });

                if (req.cr_user_type == 'bat') {
                    const dh_array = req.id_dh.split(',');
                    const user_dh_data = [];
                    dh_array.forEach((dh_data, i) => {
                        const temp = {
                            dh_id: parseInt(dh_data),
                            cr_user_id: insert[0]
                        };
                        user_dh_data.push(temp);
                    });
                    const insertDhUserRelation = await knex("cr_dh_user")
                        .insert(user_dh_data);
                }
                if (insert == 0) {
                    reject(sendApiResult(false, "Data not Inserted."));
                } else {
                    resolve(sendApiResult(true, "User Created."));
                }
            }
        } catch (error) {
            console.log(error)
            reject(sendApiResult(false, error.message));
        }
    });
}

User.getUserList = (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            const docsFi = await knex("cr_users")
                .leftJoin("cr_fi_institute", "cr_users.id_fi", "cr_fi_institute.id")
                .leftJoin("cr_dh_user", "cr_users.id", "cr_dh_user.cr_user_id")
                .leftJoin("company", "cr_dh_user.dh_id", "company.id")
                .select(
                    "cr_users.*",
                    knex.raw("CONCAT(UCASE(LEFT(cr_users.cr_user_type, 1)), SUBSTRING(cr_users.cr_user_type, 2)) as uc_user_type"),
                    knex.raw("cr_fi_institute.name as fi_name"),
                    //knex.raw("company.name as dh_name"), 
                    knex.raw("GROUP_CONCAT(company.name) as dh_name")
                )
                .orderBy("cr_users.name").groupBy("cr_users.id");
            if (docsFi == 0) reject(sendApiResult(false, "Not Found"))
            resolve(sendApiResult(true, "Data fetched successfully", docsFi));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

User.userDelete = (id) => {
    return new Promise(async (resolve, reject) => {
        try {
            const update = await knex("cr_users")
                .where({ 'id': id })
                .update({
                    activation_status: 'Inactive'
                });
            if (update == 0) {
                reject(sendApiResult(false, "Data not updated."));
            } else {
                resolve(sendApiResult(true, "User deleted."));
            }
        } catch (error) {
            console.log(error)
            reject(sendApiResult(false, error.message));
        }
    });
}

module.exports = User;