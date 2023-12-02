const { sendApiResult } = require("../controllers/helperController");
const knex = require('../config/database')
const bcrypt = require('bcryptjs');
const md5 = require("md5");
let Fi = function () { };

Fi.insertFiInstitute = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const exists = await knex("cr_fi_institute").where("name", req.body.name).count({ total: '*' }).first();
            if (exists.total != 0) {
                reject(sendApiResult(false, "This FI name already exists."));
            }else{
                await knex.transaction(async trx => {
                    req.body.logo = req.file.filename;
                    const fi_institute_insert = await trx("cr_fi_institute").insert(req.body);
                    let hashedPass = md5("++123456--");
                    const user_insert = await trx("cr_users").insert({
                        name: req.body.name,
                        email: req.body.email,
                        phone: req.body.phone,
                        password: hashedPass,
                        id_fi: fi_institute_insert[0]
                    });

                    resolve(sendApiResult(true, "Data inserted Successfully"));
                });
            }


        } catch (error) {
            reject(sendApiResult(false, error.message))
        }
    });
}

Fi.getFi = function () {
    return new Promise(async (resolve, reject) => {
        try {

            const get_fi = await knex.from("cr_fi_institute").select("*").where("activation_status", "Active");

            resolve(sendApiResult(true, "FI fetched successfully", get_fi));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Fi.editFi = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const exists = await knex("cr_fi_institute")
                            .whereNot("id",req.body.id)
                            .where("name", req.body.name).count({ total: '*' }).first();
            if (exists.total != 0) {
                reject(sendApiResult(false, "This FI name already exists."))
            }else{
                await knex.transaction(async trx => {
                    const fi_institute_update = await trx("cr_fi_institute").where({ id: req.body.id }).update({
                        'name': req.body.name,
                        'branch': req.body.branch,
                        'address': req.body.address,
                        'email': req.body.email,
                        'contact_person_name': req.body.contact_person_name,
                        'phone': req.body.phone,
                        'updated_at': new Date(),
                        'updated_by': req.body.updated_by,
                        'logo' : req.file.filename
                    });
                    if (fi_institute_update <= 0) reject(sendApiResult(false, "Could not Found FI"))
                    resolve(sendApiResult(true, "FI updated Successfully", fi_institute_update))
                });
            }
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Fi.deleteFi = function({id}){
    return new Promise(async (resolve,reject)=>{
        try {
            await knex.transaction(async trx => {
                const fi_institute_update = await trx("cr_fi_institute").where({ id: id }).update({
                    activation_status:'Inactive'
                });
                if (fi_institute_update <= 0) reject(sendApiResult(false, "Could not Found FI"))
                resolve(sendApiResult(true, "FI Deleted Successfully", fi_institute_update))
            });
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}
Fi.dhFiMapping = function(req){
    return new Promise(async(resolve,reject)=>{
        try {
            const checkExisting = await knex("cr_dh_fi")
                                        .where(function(){
                                            this.where("id_dh", req.id_dh);
                                            this.orWhere("dh_acc_no", req.dh_acc_no);
                                            //this.orWhere("id_fi", req.id_fi);
                                        })
                                        .where(function () { 
                                            if (typeof req.id !== 'undefined') {
                                                this.whereNot('id', req.id)
                                            }
                                         })
                                        .where('activation_status', 'Active')
                                        .count({total: '*'}).first();
            if (checkExisting.total != 0) {
                reject(sendApiResult(false, 'Account number altrady exists or This Distribution House is already attached to another Financial Institute.'));
            }else{
                await knex.transaction(async trx=>{
                    var dml,msg;
                    if (typeof req.id !== 'undefined') {
                        dml = await trx("cr_dh_fi")
                                    .where('id', req.id)
                                    .update(req);
                        msg = 'Mapping Updated Successfully';
                    }else{
                        dml = await trx("cr_dh_fi").insert(req);
                        msg = 'Mapping Inserted Successfully';
                    }
                    
                    if(dml==0) reject(sendApiResult(false,"Mapping insertion failed"))
                    resolve(sendApiResult(true,msg,dml));
                })
            }            
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Fi.getDocuments = function(){
    return new Promise(async(resolve,reject)=>{
        try {
            const docs = await knex("cr_document_title")
                                .select("id", "title")
                                .where("activation_status", "Active");
            if(docs==0) reject(sendApiResult(false,"Not Found"))
            resolve(sendApiResult(true,"Data fetched successfully",docs));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Fi.getDocumentsFiWise = function(){
    return new Promise(async(resolve,reject)=>{
        try {
            const docsFi = await knex("cr_document_title")
                                .leftJoin("cr_document_title_vs_fi", "cr_document_title_vs_fi.id_document_title", "cr_document_title.id")
                                .leftJoin("cr_fi_institute", "cr_document_title_vs_fi.id_fi", "cr_fi_institute.id")
                                .select(
                                    "cr_document_title.id",
                                    "cr_fi_institute.name", 
                                    "cr_document_title.title"
                                )
                                .where("cr_document_title.activation_status", "Active")
                                .where("cr_fi_institute.activation_status", "Active");
            if(docsFi==0) reject(sendApiResult(false,"Not Found"))
            resolve(sendApiResult(true,"Data fetched successfully",docsFi));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Fi.deleteFiDocRelation = function(id){
    return new Promise(async (resolve,reject)=>{
        try {
            const deleteRelation = await knex("cr_document_title_vs_fi").where({ id: id }).delete();
            if (deleteRelation <= 0) reject(sendApiResult(false, "Not found"))
            resolve(sendApiResult(true, "Deleted Successfully", deleteRelation))
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Fi.posFiDocMappingUrl = function(req){
    return new Promise(async (resolve,reject)=>{
        try {
            var obj = []; 
            for (let i = 0; i < req.id_document_title.length; i++) {
                var array = Object.values(req.id_document_title[i]);   
                let temp = {
                    id_document_title: array[0],                        
                    id_fi: req.id_fi,
                    created_by: req.created_by
                }
                obj.push(temp);                
            }
            const insert = await knex.batchInsert("cr_document_title_vs_fi",obj, 50);
            if (insert <= 0) reject(sendApiResult(false, "Not Inserted"))
            resolve(sendApiResult(true, "Inserted Successfully", insert))
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Fi.deactivateFiTransaction = function (req) { 
    return new Promise(async (resolve, reject) => {
        try {
            const update = await knex("cr_fi_institute")
                .where({
                    "id": req.id,
                }).update({'transactional_status': 'Inactive'});
            if (update == 0) throw new Error("Data not found!");
            resolve(sendApiResult(true, "Successfully Deactivated", update));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}
Fi.activateFiTransaction = function (req) { 
    return new Promise(async (resolve, reject) => {
        try {
            const update = await knex("cr_fi_institute")
                .where({
                    "id": req.id,
                }).update({'transactional_status': 'Active'});
            if (update == 0) throw new Error("Data not found!");
            resolve(sendApiResult(true, "Successfully Activated", update));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}
module.exports = Fi;