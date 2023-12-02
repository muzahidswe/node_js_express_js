
const { rejects } = require('assert')
const { resolve } = require('path')
const { send, title } = require('process')
const { groupBy, where } = require('../config/database')
const knex = require('../config/database')
const { sendApiResult,getFiBaseDpids,mappedRetailerId,generateBlobDownloadURL} = require('../controllers/helperController')
var fs = require('fs');
var moment = require('moment');


let Kyc = function () { }

/* Kyc.insertOutletDocInfo = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const checkOutlet = await knex("cr_retail_limit").where("id_outlet", req['doc_info'][0]['id_outlet']);
            if (checkOutlet.length == 0) {
                throw new Error("Outlet not in the Scope Credit Management Facility");
            } else {
                await knex.transaction(async trx => {
                    const outlets = await knex("cr_outlet_doc").where("id_outlet", req['doc_info'][0]['id_outlet']).select();
                    console.log(outlets);


                    if (outlets.length > 0) {
                        const update_nid = await knex("cr_outlet_doc")
												.where("id_outlet", req['doc_info'][0]['id_outlet'])
												.where("id_cr_document_title", 2)
												.update({
													attachment: req['doc_info'][0]['attachment']
												});
						
						const update_kyc_status = await knex("cr_retail_limit")
												.where("id_outlet", req['doc_info'][0]['id_outlet'])
												.update({
													kyc_status: "Pending"
												});
                    }
                    resolve(sendApiResult(true, req));
                })
            }


        } catch (error) {
            console.log(error.message);
            reject(sendApiResult(false, error.message));
        }
    })
} */

Kyc.insertOutletDocInfo = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            // console.log("show this 0",req['doc_info'][0]['id_outlet']);
            const id_outlet = await mappedRetailerId(req['doc_info'][0]['id_outlet']);
            const checkOutlet = await knex("cr_retail_limit").where("id_outlet", id_outlet);
            // console.log("show this 1",checkOutlet);
            if (checkOutlet.length == 0) {
                throw new Error("Outlet not in the Scope Credit Management Facility");
            } else {
                await knex.transaction(async trx => {
                    const outlets = await knex("cr_outlet_doc").where("id_outlet", id_outlet).select();
                    // console.log("show this 2",outlets);


                    if (outlets.length > 0) {

                        await knex("cr_outlet_doc").where("id_outlet", id_outlet).del();
                    }
                    const insert = await trx("cr_outlet_doc").insert(req['doc_info']);
                    if (insert == 0) reject(sendApiResult(false, "Data Could not be Submitted"));


                    if (req.otp_verification == 1) {
                        var update_phone = await trx("cr_retail_limit").where("id_outlet", id_outlet)
                            .where("activation_status", "Active")
                            .update({
                                phone: req.mobile.replace(/\s/g, ''),
                                //kyc_status: "Pending",
                                //kyc_time: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
                                otp_verification: 1
                            })
                    } else {
                        var update_phone = await trx("cr_retail_limit").where("id_outlet",id_outlet)
                            .where("activation_status", "Active")
                            .update({
                                //phone: req.mobile.replace(/\s/g, ''),
                                //kyc_status: "Initial",
                                otp_verification: 0
                            })
                    }
					
					var update_kyc_status = await trx("cr_retail_limit").where("id_outlet",id_outlet)
                            .where("activation_status", "Active")
                            .update({
                                //phone: req.mobile.replace(/\s/g, ''),
                                kyc_status: "Pending",
                                kyc_time: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
                                //otp_verification: 1
                            })

                    console.log(insert);
                    resolve(sendApiResult(true, "Data Submitted Successfully", insert));
                })
            }


        } catch (error) {
            console.log(error.message);
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.getDocumentTitle = function () {
    return new Promise(async (resolve, reject) => {
        try {
            const title = await knex("cr_document_title").select("id", "title", "file_required", "is_mendatory").where({ "activation_status": "Active" });
            if (title == 0) reject(sendApiResult(false, "Title not Found"));

            resolve(sendApiResult(true, "Document Titles Fetched", title));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.getDocumentTitleDpWise = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const title = await knex("cr_document_title")
                .select("cr_dh_fi.sms_language", "cr_document_title.id", "cr_document_title.title", "cr_document_title.file_required", "cr_document_title.nid_type", "cr_document_title.is_mendatory", "cr_document_title.file_count")
                .join('cr_document_title_vs_fi', 'cr_document_title_vs_fi.id_document_title', 'cr_document_title.id')
                .join('cr_dh_fi', 'cr_document_title_vs_fi.id_fi', 'cr_dh_fi.id_fi')
                .join('distributorspoint', 'distributorspoint.dsid', 'cr_dh_fi.id_dh')
                .where(
                    {
                        "cr_document_title.activation_status": "Active",
                        "distributorspoint.id": req.params.id,
                        // "cr_document_title.is_fi_upload_required": 0
                    })
                .groupBy("cr_document_title.id", "cr_document_title.title", "cr_document_title.file_required", "cr_document_title.is_mendatory");
            if (title == 0) reject(sendApiResult(false, "Document Title not Found"));

            var data = {
                success: true,
                message: 'Document list fetched',
                sms_language: title[0].sms_language,
                data: title
            };

            resolve(data);

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.getKyc = function (req) {
    return new Promise(async (resolve, reject) => {
        try {

            var kyc = {};


            const data = await knex.select(knex.raw(`
            distributorspoint.dsid AS house_id,
            company.name AS house,
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
            retail.kyc_status,
            region.slug as region,
            area.slug as area,
            territory.slug as territory
           `))
                .from("distributorspoint")
                .innerJoin("company", "distributorspoint.dsid", "company.id")
                .innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
                .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
                .innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
                .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
                //.innerJoin({ doc: "cr_outlet_doc" }, "retail.id_outlet", "doc.id_outlet")
                // .whereNotIn("distributorspoint.id", [334, 344, 338, 339, 339, 340])
                .where((q) => {
                    if (req.search_text) {
                        q.where("retail.outlet_code", 'like', `%${req.search_text}%`)
                    }
                })
                .where(function () {
                    this.whereIn("distributorspoint.id", req['dpids'])
                })
                /*.where(function (q) {
                    if (req['phases'] !== undefined && req['phases'].length > 0) {
                        q.whereIn("retail.phase_id", req['phases'])
                    }
                })*/
                .andWhere("distributorspoint.stts", 1)


                .andWhereNot("retail.kyc_status", "Initial")
                .orderBy("retail.id", "asc")
                .groupBy("retail.id")
                .paginate({ perPage: req['per_page'], currentPage: req['current_page'] });

            var title = [];

            if (req.id_fi != null) {
                title = await knex("cr_document_title").select("cr_document_title.id", "cr_document_title.title", "cr_document_title.file_required", "cr_document_title.is_mendatory", "cr_document_title.is_fi_upload_required", "cr_document_title.file_prefix")
                    .innerJoin("cr_document_title_vs_fi", "cr_document_title.id", "cr_document_title_vs_fi.id_document_title")
                    .where("cr_document_title_vs_fi.id_fi", req.id_fi)
            } else {
                title = await knex("cr_document_title")
                    .select("cr_document_title.id", "cr_document_title.title")
                    .join('cr_document_title_vs_fi', 'cr_document_title_vs_fi.id_document_title', 'cr_document_title.id')
                    .join('cr_dh_fi', 'cr_document_title_vs_fi.id_fi', 'cr_dh_fi.id_fi')
                    .join('distributorspoint', 'distributorspoint.dsid', 'cr_dh_fi.id_dh')
                    .where(
                        {
                            "cr_document_title.activation_status": "Active",

                        })
                    .whereIn("distributorspoint.id", req['dpids'])
                    .groupBy("cr_document_title.id", "cr_document_title.title")
                    .orderBy("cr_document_title.title");
            }
            //  const title = await knex("cr_document_title").select("id", "title").where("activation_status", "Active");
            console.log(title);

            var outlets = [];
            data.data.forEach(e => {
                outlets.push(e.id_outlet);
                kyc[e.id_outlet] = {
                    region_id: e.region_id,
                    region: e.region,
                    area_id: e.area_id,
                    area: e.area,
                    house_id: e.house_id,
                    house: e.house,
                    territory_id: e.territory_id,
                    territory: e.territory,
                    point_id: e.point_id,
                    point: e.point,
                    id_cr_retail_limit: e.id_cr_retail_limit,
                    id_cr_limit_info: e.id_cr_limit_info,
                    acc_no: e.acc_no,
                    id_outlet: e.id_outlet,
                    outlet_code: e.outlet_code,
                    outlet_name: e.outlet_name,
                    owner_name: e.owner_name,
                    phone: e.phone,
                    address: e.address,
                    kyc_status: e.kyc_status,
                    doc_info: []
                };

                title.forEach(t => {
                    kyc[e.id_outlet]['doc_info'].push({
                        "id": t.id,
                        "title": t.title,
                        "checked": "No"
                    })

                })

            });
            withoutDoc = kyc;
            const docs = await knex.select(knex.raw(`
            cr_retail_limit.id_outlet,
            cr_outlet_doc.id_cr_document_title,
            cr_outlet_doc.check_flag
            `)).from("cr_retail_limit")
                .innerJoin("cr_outlet_doc", "cr_retail_limit.id_outlet", "cr_outlet_doc.id_outlet")
                .whereIn("cr_retail_limit.id_outlet", outlets);

            docs.forEach(d => {
                if (d.id_outlet in kyc) {
                    //kyc[d.id_outlet]['doc_info'][d.id_cr_document_title]['checked'] = d.check_flag
                    kyc[d.id_outlet]['doc_info'].map((el, i) => {
                        if (el.id == d.id_cr_document_title) {
                            kyc[d.id_outlet]['doc_info'][i].checked = d.check_flag == 1 ? "Yes" : "No";
                        }
                    });


                }
            })

            var kycs = Object.values(kyc);


            var data_to_send = {
                "result": kycs,
                "pagination": data.pagination
            }

            resolve(sendApiResult(true, "true", data_to_send));



        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Kyc.approveAllKyc = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            var updateKyc = await knex("cr_retail_limit")
                .whereIn("id_point", req.dpids)
                .where("activation_status", "Active")
                .update({
                    "kyc_status": "Approved"
                });
            resolve(sendApiResult(true, "Approved Successfully."));
        } catch (error) {
            console.log(error.message)
        }
    });
}

Kyc.getKycDocsNotUploaded = function (req) {
    return new Promise(async (resolve, reject) => {
        try {

            console.log(req);
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
        DATE_FORMAT(retail.updated_at, "%d %b %Y %h:%i %p") updated_at
       `))
                .from("distributorspoint")
                .innerJoin("company", "distributorspoint.dsid", "company.id")
                .innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
                .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
                .innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
                .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
                //.whereNotIn("distributorspoint.id", [334, 338, 339, 339, 340]) //344 needs to be added
                .andWhere("distributorspoint.stts", 1)
                .whereIn("distributorspoint.id", req['dpids'])
                .where("retail.kyc_status", "Pending")
                .groupBy("retail.outlet_code")
                .orderBy("retail.id", "asc").paginate({ perPage: req['per_page'], currentPage: req['current_page'], isLengthAware: true });
            console.log(data);
            resolve(sendApiResult(true, "Outlet Without Doc Uploaded Fetched", data));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.getKycDocsSubmitted = function (req) {
    return new Promise(async (resolve, reject) => {
        try {

            console.log(req);
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
        DATE_FORMAT(retail.updated_at, "%d %b %Y %h:%i %p") updated_at
       `))
                .from("distributorspoint")
                .innerJoin("company", "distributorspoint.dsid", "company.id")
                .innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
                .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
                .innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
                .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
                //.whereNotIn("distributorspoint.id", [334, 338, 339, 339, 340]) //344 needs to be added
                .andWhere("distributorspoint.stts", 1)
                .whereIn("distributorspoint.id", req['dpids'])
                .where("retail.kyc_status", "Doc Submitted")
                .groupBy("retail.outlet_code")
                .orderBy("retail.id", "asc").paginate({ perPage: req['per_page'], currentPage: req['current_page'], isLengthAware: true });
            console.log(data);
            resolve(sendApiResult(true, "Outlets Doc Submitted Fetched", data));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.getKycRejected = function (req) {
    return new Promise(async (resolve, reject) => {
        try {

            console.log(req);
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
        DATE_FORMAT(retail.updated_at, "%d %b %Y %h:%i %p") updated_at
       `))
                .from("distributorspoint")
                .innerJoin("company", "distributorspoint.dsid", "company.id")
                .innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
                .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
                .innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
                .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
                //.whereNotIn("distributorspoint.id", [334, 338, 339, 339, 340]) //344 needs to be added
                .andWhere("distributorspoint.stts", 1)
                .whereIn("distributorspoint.id", req['dpids'])
                .where("retail.kyc_status", "Rejected")
                .orderBy("retail.id", "asc")
                .groupBy("retail.outlet_code")
                .paginate({
                    perPage: req['per_page'],
                    currentPage: req['current_page'],
                    isLengthAware: true
                });
            console.log(data);
            resolve(sendApiResult(true, "Outlet Without Doc Uploaded Fetched", data));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.getKycFiApproved = function (req) {
    return new Promise(async (resolve, reject) => {
        try {

            console.log(req);
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
        DATE_FORMAT(retail.updated_at, "%d %b %Y %h:%i %p") updated_at
       `))
                .from("distributorspoint")
                .innerJoin("company", "distributorspoint.dsid", "company.id")
                .innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
                .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
                .innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
                .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
                //.whereNotIn("distributorspoint.id", [334, 338, 339, 339, 340]) //344 needs to be added
                .whereNotIn("distributorspoint.id", [334, 344]) //344 needs to be added
                .andWhere("distributorspoint.stts", 1)
                .whereIn("distributorspoint.id", req['dpids'])
                .where("retail.kyc_status", "Approved")
                .orderBy("retail.id", "asc")
                .groupBy("retail.outlet_code")
                .paginate({
                    perPage: req['per_page'],
                    currentPage: req['current_page'],
                    isLengthAware: true
                });
            console.log(data);
            resolve(sendApiResult(true, "Outlet Without Doc Uploaded Fetched", data));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.getOutletBalance = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            let outlet_id = req['outlet_id'];

            const outlet_limit = await knex("cr_retail_limit")
                .select("id", "id_point", "id_outlet", "outlet_code", "outlet_name", "allowed_limit", "current_balance")
                .where({
                    activation_status: 1,
                    id_outlet: outlet_id
                })
                .first();
            if (outlet_limit <= 0) reject(sendApiResult(false, "No Outlet Found"));

            resolve(sendApiResult(true, "Outlet Credit Info Fetched Successfully", outlet_limit));



        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.downloadNidPerHouse = function (req) {
    return new Promise(async (resolve, reject) => {
        // let house_id = req['house_id'];
        // const house_nids = knex.select("cr_outlet_doc.attachment")
        //     .from("cr_outlet_doc")
        //     .innerJoin("cr_retail_limit", "cr_outlet_doc.id_outlet", "cr_retail_limit.id_outlet")
        //     .innerJoin("distributorspoint", "cr_retail_limit.id_point", "distributorspoint.id")
        //     .innerJoin("company", "distributorspoint.dsid", "company.id")
        //     .whereNotNull("cr_outlet_doc.attachment")
        //     .andWhere("cr_outlet_doc.activation_status", "Active")
        //     .andWhere("company.id", req);
        const outletIds = await knex.select("cr_retail_limit.outlet_code")
            .distinct()
            .from("cr_retail_limit")
            .innerJoin("cr_outlet_doc", "cr_retail_limit.id_outlet", "cr_outlet_doc.id_outlet")
            .where("cr_retail_limit.activation_status", "Active")
            .whereIn("cr_retail_limit.id_point", req.dpids).pluck("cr_retail_limit.outlet_code");

        if (outletIds <= 0) resolve([]);
        resolve(outletIds);
    })
}

Kyc.downloadNidPerOutlet = function (req) {
    return new Promise(async (resolve, reject) => {
        //let outlet_id = req['outlet_id'];
        const outlet_nids = knex.select("cr_outlet_doc.attachment")
            .from("cr_outlet_doc")
            .whereNotNull("cr_outlet_doc.attachment")
            .andWhere("cr_outlet_doc.activation_status", "Active")
            .andWhere("cr_outlet_doc.id_outlet", req);

        if (outlet_nids <= 0) resolve([]);
        resolve(outlet_nids);
    })
}

// Kyc.getOutletCountBasedOnDocUpload = function (req) {
//     return new Promise(async (resolve, reject) => {

//         try {
//             console.log(req['dpids'])
//             let all_outlet = await knex.count("retail.id_outlet as all_outlet")
//                 .from("distributorspoint")
//                 .innerJoin("company", "distributorspoint.dsid", "company.id")
//                 .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
//                 //  .whereNotIn("distributorspoint.id", [334, 338, 339, 339, 340])
//                 .andWhere("distributorspoint.stts", 1)
//                 .andWhere("retail.activation_status", "Active")
//                 .whereIn("distributorspoint.id", req['dpids']).first();
//             console.log(all_outlet);
//             all_outlet = all_outlet.all_outlet;
//             let doc_outlet = await knex.select(knex.raw(`COUNT(DISTINCT retail.id_outlet ) as doc_outlet`))
//                 .from("distributorspoint")
//                 .innerJoin("company", "distributorspoint.dsid", "company.id")
//                 .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
//                 .innerJoin({ doc: "cr_outlet_doc" }, "retail.id_outlet", "doc.id_outlet")
//                 // .whereNotIn("distributorspoint.id", [334, 338, 339, 339, 340])
//                 .andWhere("distributorspoint.stts", 1)
//                 .andWhere("retail.activation_status", "Active")
//                 .whereIn("distributorspoint.id", req['dpids'])

//                 .first();
//             console.log(doc_outlet);

//             //doc_outlet = doc_outlet.length;
//             let non_doc_outlet = all_outlet - doc_outlet.doc_outlet;
//             var output = {
//                 "all_oultet": all_outlet,
//                 "doc_outlet": doc_outlet.doc_outlet,
//                 "non_doc_outlet": non_doc_outlet
//             };
//             resolve(sendApiResult(true, "No of outlet", output));
//         } catch (error) {
//             reject(sendApiResult(false, error.message));
//         }
//     })
// }

Kyc.getOutletCountBasedOnDocUpload = function (req) {
    return new Promise(async (resolve, reject) => {

        try {
            console.log(req['dpids'])
            let all_outlet = await knex.count("retail.id_outlet as all_outlet")
                .from({ retail: "cr_retail_limit" })
                .whereIn("retail.id_point", req['dpids'])
				// .whereNotIn("retail.id_dh", [57])
				.where("retail.activation_status", 'Active')
				.first();

            all_outlet = all_outlet.all_outlet;
            let doc_outlet = await knex.count("retail.id_outlet as doc_outlet")
                .from({ retail: "cr_retail_limit" })
                .where("kyc_status", "Approved")
                .whereIn("retail.id_point", req['dpids']).first();

            let non_doc_outlet = await knex.count("retail.id_outlet as non_doc_outlet")
                .from({ retail: "cr_retail_limit" })
                .where("kyc_status", "Pending")
                .whereIn("retail.id_point", req['dpids']).first();

            let loan_approved = await knex.count("retail.id_outlet as loan_approved")
                .from({ retail: "cr_retail_limit" })
                .where("activation_status", "Active")
                .where("limit_status", "FI Confirmed")
				// .whereNotIn("retail.id_dh", [57])
                .whereIn("retail.id_point", req['dpids']).first();
            loan_approved = loan_approved.loan_approved;

            let rejected = await knex.count("retail.id_outlet as rejected")
                .from({ retail: "cr_retail_limit" })
                .where("kyc_status", "Rejected")
                .whereIn("retail.id_point", req['dpids']).first();
            rejected = rejected.rejected;

            //doc_outlet = doc_outlet.length;
            non_doc_outlet = non_doc_outlet.non_doc_outlet;
            var output = {
                "all_oultet": all_outlet,
                "doc_outlet": doc_outlet.doc_outlet,
                "non_doc_outlet": non_doc_outlet,
                "loan_approved": loan_approved,
                "rejected": rejected

            };
            resolve(sendApiResult(true, "No of outlet", output));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.outletImagePreview = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const image_data = await knex("cr_outlet_doc")
                .leftJoin("cr_retail_limit", "cr_retail_limit.id_outlet", "cr_outlet_doc.id_outlet")
                .leftJoin("cr_document_title", "cr_document_title.id", "cr_outlet_doc.id_cr_document_title")
                .select("attachment", knex.raw("cr_retail_limit.outlet_code as directory"), "cr_document_title.file_prefix")
                .where({
                    "cr_outlet_doc.activation_status": 'Active',
                    "cr_outlet_doc.id_outlet": req.params.outlet_id,

                }).whereNotNull("cr_outlet_doc.attachment").groupBy("cr_outlet_doc.attachment");
            if (image_data <= 0) reject(sendApiResult(false, "No Outlet Found"));
            let output = [];
			
            for (let i = 0; i < image_data.length; i++) {
                const element = image_data[i];
                let att = element.attachment.split(",");
                var attachment_base64 = [];
                for (let i = 0; i < att.length; i++) {
                    const e = att[i];
					if(e != 'undefined'){
						// let file = `${__dirname}/../../public/outlet_documents/${element.directory}/${e}`;
						let file = `${process.env.PUBLIC_URL}unnoti_outlet_documents/${element.directory}/${e}`;
						attachment_base64.push(base64_encode(file))
                    }
                }
                output.push({ "attachment": element.directory + '/' + element.attachment.replace(',', ',' + element.directory + '/'), "doc_title": element.file_prefix, "attachment_base64": attachment_base64.join() })
            }
            resolve(sendApiResult(true, "Attachments", output));



        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

const base64_encode = (file) => {
    // read binary data
    var bitmap = fs.readFileSync(file);
    // convert binary data to base64 encoded string
    return new Buffer(bitmap).toString('base64');
}

Kyc.uploadAccountForm = async function (files) {
    try {
        let file_arr = {};
        let outlet_arr = [];
        if (files.length > 0) {
            files.forEach(e => {
                var path = e.path.split("_");
                if (path[0] in file_arr) {
                    file_arr[path[0]].push(e.path);
                } else {
                    file_arr[path[0]] = [e.path];
                }
                if (outlet_arr.indexOf(path[0]) !== -1) {

                } else {
                    outlet_arr.push(path[0]);
                }
            })

            const upload = await updateAccountForm(outlet_arr, file_arr);
            if (upload == 0) throw new Error("Account Form Not Uploaded");
            return outlet_arr;
        }
    } catch (error) {
        return sendApiResult(false, error.message);
    }
}

const updateAccountForm = function (outlet_arr, file_arr) {
    return knex.transaction(trx => {
        let queries = [];
        outlet_arr.forEach(e => {
            const query = knex("cr_retail_limit")
                .where("outlet_code", e)
                .update({
                    account_form: file_arr[e].toString(),
                    is_account_form_uploaded: "Yes"
                }).transacting(trx);
            queries.push(query);
        })
        Promise.all(queries)
            .then(trx.commit)
            .catch(trx.rollback);
    })
}

Kyc.getKycAndDocStatus = function (outlet_id) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Outlet ID: " + outlet_id);
            const id_outlet = await mappedRetailerId(outlet_id);
            var message = "";
            var data = {};
            const outletStatus = await knex("cr_retail_limit")
                .select("kyc_status", "doc_ready")
				.where("id_outlet", id_outlet)
                .where("activation_status", "Active")
                .first();

            if (outletStatus == null) {

                data = {};
                message = "Outlet is out of credit facility";
            }
            else {

                data = outletStatus;
                message = "KYC and doc info";
            }

            console.log(data);
            resolve(sendApiResult(true, message, data));

        } catch (error) {

            var status = 0;
            message = "Outlet is out of credit facility";
            console.log(error.message);

            reject(sendApiResult(false, message, status));

        }
    })
}

Kyc.getOutletStatus = function (outlet_id) {
    return new Promise(async (resolve, reject) => {
        try {
            //console.log("Outlet ID: " + outlet_id);
			const id_outlet = await mappedRetailerId(outlet_id);
            let status = 1;
            var message = "";
			
            const outletStatus = await knex("cr_retail_limit")
                .select("kyc_status", "otp_verification", "phone")
                .where("activation_status", "Active")
                .where("id_outlet", id_outlet).first();

            if (outletStatus == null) {
                status = 0;

                message = "Outlet is out of credit facility";
            }
            else if (outletStatus.kyc_status == "Approved" || outletStatus.kyc_status == "Pending") {
                status = 0;
                message = "KYC Already Done.";
            } else if (outletStatus.kyc_status == "Rejected") {
                status = 2;
                message = "KYC rejected. Please do it again";
            } else if (outletStatus.kyc_status == "Initial") {
                status = 1;
            }
            console.log(status);
            console.log("OTP Veri: " + outletStatus.otp_verification);
            var data = {
                success: true,
                message: message,
                data: status,
                mobile: outletStatus.phone,
                // otp_verification:outletStatus.otp_verification
                otp_verification: 0
            };
            resolve(data);
        } catch (error) {

            var status = 0;
            message = "Outlet is out of credit facility";
            console.log(error.message);
            reject(sendApiResult(false, message, status));
        }
    })
}

Kyc.getKycTitleForFi = function ({ id_fi }) {
    return new Promise(async (resolve, reject) => {
        try {

            // const title = await knex("cr_document_title")
            // .select("cr_document_title.id", "cr_document_title.title","cr_document_title.file_required","cr_document_title.is_fi_upload_required","cr_document_title.is_mendatory")
            // .join('cr_document_title_vs_fi', 'cr_document_title_vs_fi.id_document_title', 'cr_document_title.id')
            // .join('cr_dh_fi', 'cr_document_title_vs_fi.id_fi', 'cr_dh_fi.id_fi')
            // .join('distributorspoint', 'distributorspoint.dsid', 'cr_dh_fi.id_dh')
            // .where(
            //     {
            //         "cr_document_title.activation_status": "Active",

            //     })
            // .whereIn("distributorspoint.id", dpids)
            // .groupBy("cr_document_title.id", "cr_document_title.title","cr_document_title.file_required","cr_document_title.is_fi_upload_required","cr_document_title.is_mendatory")
            // .orderBy("cr_document_title.title");
            // console.log(title);
            const title = await knex("cr_document_title").select("cr_document_title.id", "cr_document_title.title", "cr_document_title.file_required", "cr_document_title.is_mendatory", "cr_document_title.is_fi_upload_required", "cr_document_title.file_prefix")
                .innerJoin("cr_document_title_vs_fi", "cr_document_title.id", "cr_document_title_vs_fi.id_document_title")
                .where("cr_document_title_vs_fi.id_fi", id_fi)
                .where("cr_document_title.activation_status", 'Active')


            resolve(sendApiResult(true, "Document Title Fetched Successfully", title))

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.getScopeOutlets = function (req) {
    console.log("Scope Outlets");
    console.log(req.query)
    console.log(req.body)
    // var url = require('url');
    // var url_parts = url.parse(req.url, true);
    // var query = url_parts.query;
    var query = req.query;
    var dpids = req.body.dpids;
    var dhId = req.body.dhId;
    var filterText = req.body.filterText;

    return new Promise(async (resolve, reject) => {
        try {
            var scopeOutlets = await knex("cr_retail_limit")
                .select(
                    "cr_retail_limit.id",
                    "cr_retail_limit.outlet_code",
                    "cr_retail_limit.outlet_name",
                    "cr_retail_limit.owner_name",
                    "cr_retail_limit.phone",
                    "cr_retail_limit.address",
                    knex.raw("distributorspoint.name as dp_name"))
                .leftJoin("distributorspoint", "distributorspoint.id", "cr_retail_limit.id_point")
                .where(function () {
                    if (dhId) {
                        this.whereIn('distributorspoint.dsid', dhId)
                    } else {
                        this.whereIn("cr_retail_limit.id_point", dpids)
                    }
                    if (filterText) {
                        var search_param = filterText.toLowerCase().replace(/\s/g, '');
                        this.whereRaw(`LOWER(REPLACE(cr_retail_limit.outlet_code, ' ', '')) LIKE '%${search_param}%'`);
                    }
                })
                //.where("cr_retail_limit.kyc_status", "Initial")
                .where("cr_retail_limit.activation_status", "Active")
                .paginate({
                    perPage: query.per_page,
                    currentPage: query.page,
                    isLengthAware: true
                });
            if (scopeOutlets == 0) resolve(sendApiResult(false, "Data not found", scopeOutlets));

            resolve(sendApiResult(true, "Data successfully fetched.", scopeOutlets));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.deleteScopeOutlet = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const deleteScope = await knex("cr_retail_limit")
                .where("id", req.id)
                .update({
                    activation_status: 'Inactive'
                });
            if (deleteScope == 0) resolve(sendApiResult(false, "Data not found", deleteScope));

            resolve(sendApiResult(true, "Data successfully Deleted.", deleteScope));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Kyc.kycStatusCounter = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const count = await knex("cr_retail_limit")
                .select("kyc_status", knex.raw('count( * ) as total'))
                .where("activation_status", "Active")
                .whereIn("id_point", req.dpids)
                .groupBy("kyc_status");
            if (count == 0) resolve(sendApiResult(false, "Data not found", count));
            console.log(count)
            var output = {
                "Pending": 0,
                "Approved": 0,
                "Rejected": 0,
                "Scoped_Outlet": 0,
                "Doc_Submitted": 0
            }
            for (let i = 0; i < count.length; i++) {
                let element = count[i];
                if (element.kyc_status == 'Initial') {
                    output["Scoped_Outlet"] = element.total;
                    continue;
                }
                if (element.kyc_status == 'Doc Submitted') {
                    output["Doc_Submitted"] = element.total;
                    continue;
                }
                output[element.kyc_status] = element.total
            }
            resolve(sendApiResult(true, "Data successfully fetched.", output));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.uploadAccountForm = function (outlet_code, titles, names, created_by, id_outlet) {
    return new Promise(async (resolve, reject) => {
        try {
            var insert_list = [];
            var title_ids = [];
            if (titles.length > 0) {
                titles.forEach((e, i) => {
                    title_ids.push(e);
                    insert_list.push({
                        id_cr_document_title: e,
                        check_flag: 1,
                        id_outlet,
                        attachment: names[i],
                        created_by

                    });
                })
            }

            await knex.transaction(async trx => {
                var deletes = await trx("cr_outlet_doc").whereIn("id_cr_document_title", title_ids).where("id_outlet", id_outlet).delete();
                var insertIntoDoc = await trx("cr_outlet_doc").insert(insert_list);


                if (insertIntoDoc <= 0) throw new Error("Could not Insert to Attachments");
                var updateRetailLimit = await trx("cr_retail_limit").where("id_outlet", id_outlet).where("activation_status", "Active")
                    .update({
                        "kyc_status": "Approved"
                    });

                if (updateRetailLimit <= 0) throw new Error('Could not Upload Kyc status');

            })

            resolve(sendApiResult(true, "Kyc Uploaded Successfully"));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.rejectKyc = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            var kycReject = await knex("cr_retail_limit").where("id_outlet", req.id_outlet)
                .where("activation_status", 'Active')
                .update({
                    kyc_status: "Rejected",
                    "rejection_reason": req.reason
                });
            if (kycReject <= 0) throw new Error("Could not reject Kyc");

            resolve(sendApiResult(true, "KYC Rejected Successfully"));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.fiBulkUpload = function (permitted_outlets, rejected_outlet, all_outlets, created_by) {
    return new Promise(async (resolve, reject) => {
        try {
            var outlet_ids = await knex("cr_retail_limit").select("id_outlet", "outlet_code").whereIn("outlet_code", permitted_outlets).andWhere("activation_status", "Active");
            console.log(outlet_ids)
            var id_outlets = {};
            outlet_ids.forEach(e => {
                id_outlets[e.outlet_code] = e.id_outlet;
            })

            var doc_insert_arr = [];

            var doc_ids = [];
            var id_out = [];
            if (permitted_outlets.length > 0) {
                permitted_outlets.forEach(e => {
                    var outlet_docs = all_outlets[e];
                    for (const [key, value] of Object.entries(outlet_docs)) {
                        if (!doc_ids.includes(key)) {
                            doc_ids.push(key);
                        }

                        var id_outlet = id_outlets[e];
                        if (!id_out.includes(id_outlet)) {
                            id_out.push(id_outlet);
                        }
                        doc_insert_arr.push({
                            id_cr_document_title: key,
                            id_outlet,
                            attachment: value,
                            created_by
                        })
                    }

                })
            }

            console.log(doc_insert_arr);
            console.log(permitted_outlets);
            await knex.transaction(async trx => {
                var del = await trx("cr_outlet_doc").whereIn("id_cr_document_title", doc_ids).whereIn("id_outlet", id_out).delete();
                var insert = await trx("cr_outlet_doc").insert(doc_insert_arr);
                var update_retailer_approve = await trx("cr_retail_limit").whereIn("outlet_code", permitted_outlets).update({
                    kyc_status: "Approved",
                    rejection_reason: null
                })
                var update_retailer_reject = await trx("cr_retail_limit").whereIn("outlet_code", rejected_outlet).update({
                    kyc_status: "Rejected",
                    rejection_reason: "Document Not Found"
                })

            })

            resolve(sendApiResult(true, "Bulk Upload Completed"));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.getComparison = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const statusToCheck = ['BAT Modified', 'BAT Approved'];
            var sql = `(SELECT
                            t1.outlet_code,
                            t1.outlet_name,
                            t1.owner_name,
                            t1.phone,
                            t1.address,
                            t1.acc_no,
                            t1.credit_amount fi_init_amt,`;
            if (!statusToCheck.includes(req.status)) {
                sql += ` t2.credit_amount bat_mod_app_amt,
                                t3.credit_amount fi_approved_amt`;
            } else {
                sql += ` t3.credit_amount bat_mod_app_amt`;
            }
            sql += ` FROM
                            ( SELECT * FROM cr_retail_limit_log_details WHERE id_cr_retail_limit_log = ( SELECT min( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.id} ) ) AS t1,`;
            if (!statusToCheck.includes(req.status)) {
                sql += ` (
                                SELECT
                                    * 
                                FROM
                                    cr_retail_limit_log_details 
                                WHERE
                                    id_cr_retail_limit_log > ( SELECT min( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.id} ) 
                                    AND id_cr_retail_limit_log < ( SELECT max( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.id} ) 
                                    AND id_cr_limit_info = ${req.id}
                                ) AS t2,`;
            }
            sql += ` ( SELECT * FROM cr_retail_limit_log_details WHERE id_cr_retail_limit_log = ( SELECT max( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.id} ) ) AS t3
                            
                        WHERE 1=1`;
            if (!statusToCheck.includes(req.status)) {
                sql += ` AND t1.outlet_code = t2.outlet_code`;
            }
            sql += ` AND t1.outlet_code = t3.outlet_code`;
            if (!statusToCheck.includes(req.status)) {
                sql += ` AND (t1.credit_amount != t3.credit_amount OR t1.credit_amount != t2.credit_amount  OR t2.credit_amount != t3.credit_amount)`;
            } else {
                sql += ` AND (t1.credit_amount != t3.credit_amount)`;
            }
            sql += ` ) as tdata`;
            const data = await knex(knex.raw(sql))
                .paginate({
                    perPage: req['per_page'],
                    currentPage: req['current_page'],
                    isLengthAware: true
                });
            resolve(sendApiResult(true, "Outlet Without Doc Uploaded Fetched", data));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

Kyc.mobileNoCheck = function (phone, id_outlet) {
    return new Promise(async (resolve, reject) => {
        try {
            const unnoti_id_outlet = await mappedRetailerId(id_outlet);
            const phoneNo = await knex("cr_retail_limit").select("phone")
                .where(function () {
                    this.where("activation_status", 'Active');
                    if (typeof unnoti_id_outlet !== 'undefined') {
                        this.whereNot("id_outlet", unnoti_id_outlet);
                    }
                })
                .where(function () {
                    this.where("phone", phone)
                    this.orWhere("phone", '0' + phone)
                    this.orWhere("phone", '88' + phone)
                    this.orWhere("phone", '880' + phone)
                    this.orWhere("phone", phone.substring(1))
                    this.orWhere("phone", phone.substring(2))
                })
                .limit(1);
            const data = {};
            if (phoneNo <= 0) {
                data.result = 'number_does_not_exist';
                data.message = 'You can proceed with this number';
                resolve(data);
            } else {
                data.result = 'number_exist';
                data.message = 'This number already used for KYC. You can\'t use same number twice.';
                resolve(data);
            }
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Kyc.getNidInfo = async (retailer_id) => {
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex("cr_nid_info").select("*")
                .where(function () {
                    this.where("retailer_id", retailer_id);
                });
            if (data == 0) throw new Error("No Data Found");

            resolve(sendApiResult(true, "Nid Info Fetched", data));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Kyc.postNidInfo = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            const document_info = await knex("cr_document_title").where("id", req.body.document_id).first();
            const type = document_info.nid_type;
            delete req.body.document_id;
            var dml;
            dml = await knex("cr_nid_info").insert({ ...req.body, retailer_id: req.params.retailer_id, type });
            // dml = await knex("cr_nid_info")                
            //     .where(function () { 
            //         this.where("retailer_id", req.params.retailer_id);
            //         this.where("type", req.body.type);
            //     }).update(req.body);

            // if(dml == 0){
            //     dml = await knex("cr_nid_info").insert({...req.body, retailer_id:req.params.retailer_id});
            // }
            if (dml == 0) {
                throw new Error("Something bad happened!");
            }

            resolve(sendApiResult(true, "Data Inserted/Updated Successfully.", dml));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Kyc.kycDocumentStatus = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {

            console.log("kyc_doc_status")
            const data = await knex("cr_retail_limit")
                .select(
                    "cr_retail_limit.id_point",
                    "cr_retail_limit.id_dh",
                    "cr_retail_limit.id_outlet",
                    "cr_retail_limit.outlet_code",
                    "cr_retail_limit.outlet_name",
                    knex.raw(`CONCAT(routes.number,section_days.slug) AS route`)
                )
                // .leftJoin("retailers", "retailers.id", "cr_retail_limit.id_outlet")
                .leftJoin("retailers", "retailers.retailer_code", "cr_retail_limit.outlet_code")
                .leftJoin("routes", "routes.id", "retailers.rtid")
                .leftJoin("section_days", "routes.section", "section_days.section")
                .whereRaw(`cr_retail_limit.outlet_code in (SELECT 
                                    distinct retailer_code
                                FROM
                                    (SELECT
                                        routes.id AS route_id
                                    FROM
                                        routes
                                    INNER JOIN dhrs ON FIND_IN_SET( routes.id, dhrs.routes ) >0 
                                        AND dhrs.type = 151 AND dhrs.id = ${req.params.dhrs_id}
                                    WHERE
                                        routes.stts = 1
                                        AND routes.section NOT IN ( 498, 516 )
                                    GROUP BY
                                        routes.id
                                    ) as x
                                INNER JOIN retailers ON retailers.rtid = x.route_id
                                WHERE 
                                    stts = 1)`)
                .where("cr_retail_limit.doc_ready", req.params.doc_ready)
                .where("retailers.stts",1);

            if (data === 0) throw new Error("No data found!");

            resolve(sendApiResult(true, "Data Fetched Successfully.", data));
        } catch (error) {
            console.log(error);
            reject(sendApiResult(false, error.message));
        }
    });
}

Kyc.kycDocumentStatusByPoint = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            const data = await knex("cr_retail_limit")
                .select(
                    "cr_retail_limit.id_point",
                    "cr_retail_limit.id_dh",
                    "cr_retail_limit.id_outlet",
                    "cr_retail_limit.outlet_code",
                    "cr_retail_limit.outlet_name",
                    knex.raw(`CONCAT(routes.number,section_days.slug) AS route`)
                )
                .leftJoin("retailers", "retailers.id", "cr_retail_limit.id_outlet")
                .leftJoin("routes", "routes.id", "retailers.rtid")
                .leftJoin("section_days", "routes.section", "section_days.section")
                .where(`cr_retail_limit.id_point`, req.params.point_id)
                .where("cr_retail_limit.doc_ready", req.params.doc_ready);

            if (data === 0) throw new Error("No data found!");

            resolve(sendApiResult(true, "Data Fetched Successfully.", data));
        } catch (error) {
            console.log(error);
            reject(sendApiResult(false, error.message));
        }
    });
}

Kyc.updateDocReady = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {

            const id_outlet = await mappedRetailerId(req.params.id_outlet);
            const update = await knex("cr_retail_limit")
                .where("id_outlet", id_outlet)
                .update({
                    "doc_ready": req.params.status
                });

            if (update === 0) throw new Error("No data Updated!");

            resolve(sendApiResult(true, "Data Updated Successfully.", update));
        } catch (error) {
            console.log(error);
            reject(sendApiResult(false, error.message));
        }
    });
}


Kyc.updateOtpVerification = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            const id_outlet = await mappedRetailerId(req.params.id_outlet);
            const update = await knex("cr_retail_limit")
                .where("id_outlet", id_outlet)
                .update({
                    "kyc_status": 'Pending',
                    "otp_verification": 1
                });

            if (update === 0) throw new Error("No data Updated!");

            resolve(sendApiResult(true, "Data Updated Successfully.", update));
        } catch (error) {
            console.log(error);
            reject(sendApiResult(false, error.message));
        }
    });
}

Kyc.retailerNidInformation = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
			//const fi_permitted_user = await knex("cr_user_fi_mapping").select("id_user", "ids_fi");
            const data = await knex("cr_retail_additional_info_upload_log")
                .select(
                    knex.raw(`DATE_FORMAT(cr_retail_additional_info_upload_log.sys_date, "%d %b %Y") AS sys_date`),
                    "cr_retail_additional_info_upload_log.file_path",
                    "cr_retail_additional_info_upload_log.file_name",
                    "cr_retail_additional_info_upload_log.found_rows",
                    "cr_retail_additional_info_upload_log.upload_rows",
                    "cr_users.name AS upload_by",
					"cr_retail_additional_info_upload_log.created_by",
                    knex.raw(`(cr_retail_additional_info_upload_log.found_rows - cr_retail_additional_info_upload_log.upload_rows) AS difference`)
                )
                .innerJoin("cr_users", "cr_users.id", "cr_retail_additional_info_upload_log.created_by")
				//.where("cr_retail_additional_info_upload_log.created_by", req.query.fi_id)
                .orderBy("cr_retail_additional_info_upload_log.id", "DESC");
			console.log(data);

            resolve(sendApiResult(true, "Data Updated Successfully.", data));
        } catch (error) {
            console.log(error);
            reject(sendApiResult(false, error.message));
        }
    });
}


Kyc.pendingLoanCustomerId = async (req) => {
    const dpids = await getFiBaseDpids(req.fi_id);
    return new Promise(async (resolve, reject) => {
        try {
            const outletList = await knex("cr_retail_limit")
                .select(
                    "distributorspoint.name AS dp_name",
                    "cr_retail_limit.outlet_code",
                    "cr_retail_limit.outlet_name",
                    "cr_retail_limit.owner_name",
                    "cr_retail_limit.phone",
                    knex.raw(`DATE_FORMAT(cr_retail_limit.kyc_time, "%d %b %Y") AS kyc_date`),
                    "cr_retail_limit.kyc_status AS kyc_status"
                )
                .where(function () {
                    if (dpids) {
                        this.whereIn("cr_retail_limit.id_point", dpids);
                    }
                })
                .innerJoin("distributorspoint", "cr_retail_limit.id_point", "distributorspoint.id")
                // .whereNotIn("cr_retail_limit.id_point", [334, 344])
                // .whereNotIn("cr_retail_limit.id_dh", [57])
                .whereIn("cr_retail_limit.kyc_status", ['Approved'])
                .whereNull("cr_retail_limit.loan_account_number")
                .whereNull("cr_retail_limit.client_id")
                .orderBy("cr_retail_limit.outlet_code");
            resolve(sendApiResult(true, "Data Fetched Successfully.", outletList));
        } catch (error) {
            console.log(error);
            reject(sendApiResult(false, error.message));
        }
    });
}

Kyc.loanCustomerIdAdjustment = async (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            const client_id_info = await knex("cr_retail_limit")
                .select(
                    knex.raw(`MAX(cr_retail_limit.client_id) AS max_client_id`)
                )
                .where("cr_retail_limit.client_id",  '>=', 10000000)
				.whereNotNull("cr_retail_limit.client_id");

            const data = await knex("cr_retail_limit")
                .select(
                    "cr_retail_limit.id_dh",
                    knex.raw(`MAX(cr_retail_limit.loan_account_number) AS max_loan_ac_num`),
                    "cr_retail_loan_ac_dh_code.fixed_part",
                    "cr_retail_loan_ac_dh_code.dh_code"
                )
                .innerJoin("cr_retail_loan_ac_dh_code", "cr_retail_limit.id_dh", "cr_retail_loan_ac_dh_code.id_dh")
                .whereIn("cr_retail_limit.kyc_status", ['Approved'])
                // .whereNotNull("cr_retail_limit.loan_account_number")
                .groupBy("cr_retail_limit.id_dh");

            var loan_ac_info = [];
			var number_starts = 1;
			var dh_ids = [];
            for (const [key, value] of Object.entries(data)) {
                var temp = {};
                temp['house_id'] = value.id_dh;
                temp['fixed_part'] = value.fixed_part;
                temp['dh_code'] = value.dh_code;
				if(value.max_loan_ac_num != null){
					temp['max_loan_no'] = parseInt(value.max_loan_ac_num.substr(value.max_loan_ac_num.length - 5));
				} else {
					temp['max_loan_no'] = 0;
				}
                loan_ac_info.push(temp);
            }

            const outletList = await knex("cr_retail_limit")
                .select(
                    "cr_retail_limit.id",
                    "cr_retail_limit.id_dh",
                    "cr_retail_limit.id_outlet",
                    "cr_retail_limit.outlet_code"
                )
                // .whereNotIn("cr_retail_limit.id_point", [334, 344])
                // .whereNotIn("cr_retail_limit.id_dh", [57])
                .whereIn("cr_retail_limit.kyc_status", ['Approved'])
                .whereNull("cr_retail_limit.loan_account_number")
                .whereNull("cr_retail_limit.client_id")
                .orderBy("cr_retail_limit.id_dh");

            var max_client_id = client_id_info[0].max_client_id;
            var ac_info, id_dh_info = [];
            for (const [key, value] of Object.entries(outletList)) {
                for (const [index, loan_info] of Object.entries(loan_ac_info)) {
                    if (value.id_dh == loan_info.house_id) {
                        ++max_client_id;
                        if (!id_dh_info.includes(value.id_dh)) {
                            id_dh_info.push(value.id_dh);
                            ac_info = loan_info.max_loan_no + 1;
                        }
                        else ++ac_info;

                        var loan_account_number = loan_info.fixed_part + '' + loan_info.dh_code + '' + await padLeadingZeros(ac_info, 5);
                        // console.log('outlet code: ' + value.outlet_code + ' client_id: ' + max_client_id + ' ac_info: ' + loan_account_number);
                        await knex("cr_retail_limit")
                            .where("id", value.id)
                            .update({
                                "loan_account_number": loan_account_number,
                                "cr_retail_limit.client_id": max_client_id
                            });
                    }
                }
            }
            resolve(sendApiResult(true, "Loan Account Number & Customer ID Created Successfully.", outletList));
        } catch (error) {
            console.log(error);
            reject(sendApiResult(false, error.message));
        }
    });
}

// By Mahfuz

Kyc.getSmsGaetwayList = async function (req) {
	 return new Promise(async (resolve, reject) => {
        try {
			const gatewayList = await knex("cr_sms_gateway")
                .select(
					"cr_sms_gateway.id",
                    "cr_sms_gateway.name",
                    "cr_sms_gateway.status",
				)
			if (gatewayList == 0) resolve(sendApiResult(false, "Gateway not found", gatewayList));
			
			resolve(sendApiResult(true, "Gateway List", gatewayList));
			
		} catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Kyc.changeSmsGateway = async function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            const activeGateway = await knex("cr_sms_gateway")
                .where("id", req.body.active_gateway)
                .update({
                    status: 1
                });
				
			if (activeGateway == 0) resolve(sendApiResult(false, "Gateway not found", activeGateway));
			
			const deactiveGateay = await knex("cr_sms_gateway")
                .whereNot("id", req.body.active_gateway)
                .update({
                    status: 0
                });

            resolve(sendApiResult(true, "Gateway successfully Activated.", activeGateway));

        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    });
}

Kyc.uploadRetailerPhoneNumberChangeSingle = async(req) =>{
    return new Promise(async (resolve, reject) => {

       
        try {
            console.log(req);
			const outletCode = req.outlet_code;
            const phoneNumber = req.phone_number;

            if(phoneNumber.length != 11)
            {
                return resolve(sendApiResult(false, `Code: ${outletCode}. Phone number is not valid`));
            }

            const existOutletCode = await knex("cr_retail_limit").select("outlet_code").where("outlet_code", outletCode).first();
            if(existOutletCode === undefined)
            {
               return resolve(sendApiResult(false, `Code: ${outletCode} is not exist on recode`));
            }
            await knex("cr_retail_limit").where("outlet_code",outletCode).update({
                phone : phoneNumber
            });

            insertChangeLog = await knex("cr_retailer_phone_number_change_log").insert({
                changed_by : req.user_id,
                change_type : 'single',
                outlet_code : outletCode
            });

            resolve(sendApiResult(true, "Retailer phone number change successfully!"));
			
		} catch (error) {
            reject(sendApiResult(false, error.message));
        }
        
    })
}
const padLeadingZeros = async function (num, size) {
    var s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

Kyc.fetchPorichoyPdfImage = function (req) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log(req.params.outlet_code);
            const outlet = await knex('cr_retail_limit').select('outlet_code').where('outlet_code',req.params.outlet_code).first();
            if (outlet == null) {
				resolve(sendApiResult(false, "Outlet not found", {status:404}));
				return false;
			}
            console.log(outlet.outlet_code);
            const fileName = `${outlet.outlet_code}/${outlet.outlet_code}_দোকানদারের-নিজের-ছবি-১-কপি_front.jpg`
            let file = `${process.env.PUBLIC_URL}unnoti_outlet_documents/${fileName}`;
            // const attachment_base64 = base64_encode(file);
            // resolve(sendApiResult(true, "Attachments", `data:image/png;base64,${attachment_base64}`));
            resolve(sendApiResult(true, "Attachments", generateBlobDownloadURL(file)));
        } catch (error) {
            reject(sendApiResult(false, error.message));
        }
    })
}

module.exports = Kyc;