const { leftJoin } = require('../config/database')
const knex = require('../config/database')
const { sendApiResult } = require('../controllers/helperController')
let Dh = function(){}

Dh.getDh = function(){
    return new Promise(async (resolve, reject) => {
        try {
            const get_fi = await knex.from("company").select("id","name").orderBy('name', 'asc');
            resolve(sendApiResult(true, "DH fetched successfully", get_fi));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Dh.dhWiseFiList = function(){
    return new Promise(async (resolve, reject) => {
        try {
            const get_fi = await knex.from("cr_dh_fi")
            .select("cr_dh_fi.id",
                "cr_dh_fi.id_dh",
                "cr_dh_fi.id_fi", 
                "company.name as dh", 
                "cr_dh_fi.dh_acc_no", 
                "cr_fi_institute.name as fi", 
                "cr_dh_fi.activation_status as status")
            .leftJoin("company","company.id","cr_dh_fi.id_dh")
            .leftJoin("cr_fi_institute","cr_fi_institute.id","cr_dh_fi.id_fi")
            //.where('cr_dh_fi.activation_status',"Active");
            resolve(sendApiResult(true, "DH-FI fetched successfully", get_fi));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Dh.deactivateFiDhRelation = async function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const update = await knex("cr_dh_fi")
                .select("attachment", knex.raw("cr_retail_limit.outlet_code as directory"))
                .where({
                    "id": req.id,

                }).update({'activation_status': 'Inactive'});
            if (update == 0) throw new Error("Data not found!");
            resolve(sendApiResult(true, "Successfully Deactivated", update));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Dh.activateFiDhRelation = async function (req) { 
    return new Promise(async (resolve, reject) => {
        try {
            const checkExisting = await knex("cr_dh_fi")
                                        .where(function(){
                                            this.where("id_dh", req.id_dh);
                                        })
                                        .where('activation_status', 'Active')
                                        .count({total: '*'}).first();
            if (checkExisting.total != 0) {
                reject(sendApiResult(false, 'This Distribution is already attached to another Financial Institute.'));
            }else{
                const update = await knex("cr_dh_fi")
                    .select("attachment", knex.raw("cr_retail_limit.outlet_code as directory"))
                    .where({
                        "id": req.id,

                    }).update({'activation_status': 'Active'});
                if (update == 0) throw new Error("Data not found!");
                resolve(sendApiResult(true, "Successfully Deactivated", update));
            }            
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

module.exports = Dh;