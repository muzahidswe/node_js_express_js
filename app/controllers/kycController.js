const { sendApiResult,
    saveZip,
    saveZipFolder,
    saveZipMultipleFolder,
    generaeteExcel,
    createExcle,
    timeout,
    generateBlobDownloadURL } = require("./helperController")
var fs = require('fs');
const Kyc = require("../Models/KycModel");
const AdmZip = require('adm-zip');
const decompress = require('decompress');
const knex = require("../config/database");
const excel = require('excel4node');
const { title } = require("process");
var moment = require('moment');
const axios = require('axios');
exports.insertOutletDocInfo = async (req, res) => {
    try {

        const result = await Kyc.insertOutletDocInfo(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getDocumentTitle = async (req, res) => {
    try {
        const title = await Kyc.getDocumentTitle();
        res.status(200).send(title);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getDocumentTitleDpWise = async (req, res) => {
    try {
        const title = await Kyc.getDocumentTitleDpWise(req);
        res.status(200).send(title);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getDocumentTitlesVsFi = async (req, res) => {
    try {
        const data = await Kyc.getDocumentTitleDpWise(req);
        res.status(200).send(data);
    } catch (error) {

    }
}

exports.uploadRetailerDocuments = (req, res) => {
    res.status(200).send(sendApiResult(true, "Retailer Documents Uploaded Successfully"));
}

exports.getKyc = async (req, res) => {
    try {
        const result = await Kyc.getKyc(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.approveAllKyc = async (req, res) => {
    try {
        const result = await Kyc.approveAllKyc(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getKycDocsNotUploaded = async (req, res) => {
    try {
        const result = await Kyc.getKycDocsNotUploaded(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getKycDocsNotUploadedDownload = async (req, res) => {
    try {
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
				DATE_FORMAT(retail.kyc_time, "%d %b %Y") AS kyc_registration_date,
				DATE_FORMAT(retail.kyc_time, "%h:%i:%s %p") AS kyc_registration_time`))
            .from("distributorspoint")
            .innerJoin("company", "distributorspoint.dsid", "company.id")
            .innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
            .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
            .innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
            .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
            //.whereNotIn("distributorspoint.id", [334, 338, 339, 339, 340]) //344 needs to be added
            .andWhere("distributorspoint.stts", 1)
            .whereIn("distributorspoint.id", req.body['dpids'])
            .where("retail.kyc_status", "Pending")
            .groupBy("retail.outlet_code")
            .orderBy("retail.id", "asc");
        // console.log(data);
        const header = {
            'region': 'Region',
            'area': 'Area',
            'house': 'House',
            'territory': 'Territory',
            'point': 'Point',
            'outlet_code': 'Outlet Code',
            'outlet_name': 'Outlet Name',
            'owner_name': 'Owner Name',
            'phone': 'Phone',
            'address': 'Address',
            'kyc_registration_date': 'KYC Registration Date',
            'kyc_registration_time': 'KYC Registration Time'
        }
        const fileName = generaeteExcel(header, data, 'KYC_Done_by_SS', []);
        await timeout(1500);
        const url = generateBlobDownloadURL(fileName)
        res.send(sendApiResult(true, "File Generated", url));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getKycDocsSubmitted = async (req, res) => {
    try {
        const result = await Kyc.getKycDocsSubmitted(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getKycDocsSubmittedDownload = async (req, res) => {
    try {
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
                                retail.address`))
            .from("distributorspoint")
            .innerJoin("company", "distributorspoint.dsid", "company.id")
            .innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
            .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
            .innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
            .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
            //.whereNotIn("distributorspoint.id", [334, 338, 339, 339, 340]) //344 needs to be added
            .andWhere("distributorspoint.stts", 1)
            .whereIn("distributorspoint.id", req.body['dpids'])
            .where("retail.kyc_status", "Doc Submitted")
            .groupBy("retail.outlet_code")
            .orderBy("retail.id", "asc");
        const header = {
            'region': 'Region',
            'area': 'Area',
            'house': 'House',
            'territory': 'Territory',
            'point': 'Point',
            'outlet_code': 'Outlet Code',
            'outlet_name': 'Outlet Name',
            'owner_name': 'Owner Name',
            'phone': 'Phone',
            'address': 'Address'
        }
        const fileName = generaeteExcel(header, data, 'KYC_Doc_Submitted', []);
        await timeout(1500);
        const url = generateBlobDownloadURL(fileName)
        res.send(sendApiResult(true, "File Generated", url));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getKycRejected = async (req, res) => {
    try {
        const result = await Kyc.getKycRejected(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getKycRejectedDownload = async (req, res) => {
    try {
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
                                retail.rejection_reason`))
            .from("distributorspoint")
            .innerJoin("company", "distributorspoint.dsid", "company.id")
            .innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
            .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
            .innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
            .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
            //.whereNotIn("distributorspoint.id", [334, 338, 339, 339, 340]) //344 needs to be added
            .andWhere("distributorspoint.stts", 1)
            .whereIn("distributorspoint.id", req.body['dpids'])
            .where("retail.kyc_status", "Rejected")
            .orderBy("retail.id", "asc")
            .groupBy("retail.outlet_code");
        const header = {
            'region': 'Region',
            'area': 'Area',
            'house': 'House',
            'territory': 'Territory',
            'point': 'Point',
            'rejection_reason': 'Rejection Reason',
            'outlet_code': 'Outlet Code',
            'outlet_name': 'Outlet Name',
            'owner_name': 'Owner Name',
            'phone': 'Phone',
            'address': 'Address'
        }
        const fileName = generaeteExcel(header, data, 'Rejected_Outlets', []);
        await timeout(1500);
        const url = generateBlobDownloadURL(fileName)
        res.send(sendApiResult(true, "File Generated", url));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getKycFiApproved = async (req, res) => {
    try {
        const result = await Kyc.getKycFiApproved(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getKycFiApprovedDownload = async (req, res) => {
    try {
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
                            retail.rejection_reason`))
            .from("distributorspoint")
            .innerJoin("company", "distributorspoint.dsid", "company.id")
            .innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
            .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
            .innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
            .innerJoin({ retail: "cr_retail_limit" }, "distributorspoint.id", "retail.id_point")
            //.whereNotIn("distributorspoint.id", [334, 338, 339, 339, 340]) //344 needs to be added
            .andWhere("distributorspoint.stts", 1)
            .whereIn("distributorspoint.id", req.body['dpids'])
            .where("retail.kyc_status", "Approved")
            .orderBy("retail.id", "asc")
            .groupBy("retail.outlet_code");
        const header = {
            'region': 'Region',
            'area': 'Area',
            'house': 'House',
            'territory': 'Territory',
            'point': 'Point',
            'outlet_code': 'Outlet Code',
            'outlet_name': 'Outlet Name',
            'owner_name': 'Owner Name',
            'phone': 'Phone',
            'address': 'Address'
        }
        const fileName = generaeteExcel(header, data, 'KYC_Approved_FI', []);
        await timeout(1500);
        const url = generateBlobDownloadURL(fileName)
        res.send(sendApiResult(true, "File Generated", url));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getOutletBalance = async (req, res) => {
    try {
        const result = await Kyc.getOutletBalance(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}


exports.downloadNidPerHouse = async (req, res) => {
    try {

        const outlet_codes = await Kyc.downloadNidPerHouse(req.body);
        console.log(outlet_codes);
        //  res.send(sendApiResult(false, "no nids found",nids));
        // var downloadName = await saveZipMultipleFolder(outlet_codes, "outlet_documents", "zip_outlet_document");
        var downloadName = await saveZipMultipleFolder(outlet_codes, "unnoti_outlet_documents", "zip_outlet_document");
        if (!downloadName) {
            res.send(sendApiResult(false, "no nids found",));
        }
        const url = generateBlobDownloadURL("zip_outlet_document" + "/" + downloadName);
        res.status(200).send(sendApiResult(true, "File name ", url));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.downloadNidPerOutlet = async (req, res) => {
    try {


        // var downloadName = saveZipFolder(`outlet_documents/${req.params.outlet_code}`, "zip_outlet_document", req.params.outlet_code);
        var downloadName = saveZipFolder(`unnoti_outlet_documents/${req.params.outlet_code}`, "zip_outlet_document", req.params.outlet_code);
        if (!downloadName) {
            res.send(sendApiResult(false, "no nids found",));
        }
        const url = generateBlobDownloadURL("zip_outlet_document" + "/" + downloadName);
        res.status(200).send(sendApiResult(true, "File name ", url));


    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getOutletCountBasedOnDocUpload = async (req, res) => {
    try {
        var result = await Kyc.getOutletCountBasedOnDocUpload(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}


exports.outletImagePreview = async (req, res) => {
    try {
        var result = await Kyc.outletImagePreview(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.uploadApplicationFormZip = async (req, res) => {
    try {
        const dest = process.env.PUBLIC_URL + "account_form";
        const fileName = req.file.filename;
        var files = await decompress(dest + "/" + fileName, dest);
        const update = await Kyc.uploadAccountForm(files);
        console.log(update);
        fs.unlink(dest + "/" + fileName, function (err) {
            if (err && err.code == "ENOENT") {
                // file doens't exist
                console.info("File doesn't exist, won't remove it.");
            } else if (err) {
                // other errors, e.g. maybe we don't have enough permission
                console.error("Error occurred while trying to remove file");
            } else {
                console.info(`removed`);
            }
        });
        if (update == null) {
            res.status(500).send(sendApiResult(false, "Application Form Not Uploaded"))
        } else {
            res.status(200).send(sendApiResult(true, "Application Form Uploaded Successfully", update));
        }


    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.downloadKycOutletInfo = async (req, res) => {
    try {
        var today = moment(new Date()).format('YYYY-MM-DD');
        const data = await knex.select(knex.raw(
            `region.slug AS region,
            area.slug AS area,            
            company.name AS house,            
            territory.slug AS territory,
            distributorspoint.name AS point,                      
            retail.outlet_code,
            retail.outlet_name,
            retail.owner_name,
            retail.phone,
            retail.address,            
            retail.account_form,
            retail.kyc_status,
            DATE_FORMAT(retail.kyc_time, "%d %b %Y") AS kyc_registration_date,
            DATE_FORMAT(retail.kyc_time, "%h:%i:%s %p") AS kyc_registration_time,
            cr_retail_phase.name AS phase_name
            `))
            .from("cr_retail_limit AS retail")
            .innerJoin("distributorspoint", "distributorspoint.id", "retail.id_point")
            .innerJoin("company", "distributorspoint.dsid", "company.id")
            .innerJoin({ region: "_locations" }, "distributorspoint.region", "region.id")
            .innerJoin({ area: "_locations" }, "distributorspoint.area", "area.id")
            .innerJoin({ territory: "_locations" }, "distributorspoint.territory", "territory.id")
            .innerJoin("cr_retail_phase", "cr_retail_phase.id", "retail.phase_id")
            .whereIn("retail.id_point", req.body['dpids'])
            .where("retail.activation_status", 'Active')
            .andWhere("distributorspoint.stts", 1)
            .orderBy("retail.id", "asc")
            .groupBy("retail.outlet_code");
        var title = [];
        if (req.body['id_fi'] != null) {
            title = await knex("cr_document_title").select("cr_document_title.id", "cr_document_title.title", "cr_document_title.file_required", "cr_document_title.is_mendatory", "cr_document_title.is_fi_upload_required", "cr_document_title.file_prefix")
                .innerJoin("cr_document_title_vs_fi", "cr_document_title.id", "cr_document_title_vs_fi.id_document_title")
                .where("cr_document_title_vs_fi.id_fi", req.body['id_fi'])
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
                .whereIn("distributorspoint.id", req.body['dpids'])
                .groupBy("cr_document_title.id", "cr_document_title.title")
                .orderBy("cr_document_title.title");
        }
        var headers = ["Status", "Region", "Area", "House", "Territory", "Point", "Outlet Code", "Outlet Name", "Owner Name", "Phone", "Address", "Acc Form", "Phase Name"];
        if (title.length > 0) {
            title.forEach(e => {
                headers.push(e.title);
            })
        }
        var workbook = new excel.Workbook();
        var worksheet = workbook.addWorksheet('Sheet 1');
        var headerStyle = workbook.createStyle({
            fill: {
                type: 'pattern',
                patternType: 'solid',
                bgColor: '#E1F0FF',
                fgColor: '#E1F0FF',
            },
            font: {
                color: "#000000",
                size: "10",
                bold: true
            },
        })
        var col = 1;
        var row = 1;
        var col_add = 0;
        headers.forEach(e => {
            worksheet.cell(row, col + col_add).string(e).style(headerStyle);
            col_add++;
        });
        row = 2;
        for (let i = 0; i < data.length; i++) {
            var col_add = 0;
            let e = data[i];
            worksheet.cell(row, col + col_add).string(e.kyc_status ? e.kyc_status : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.region ? e.region : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.area ? e.area : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.house ? e.house : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.territory ? e.territory : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.point ? e.point : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.outlet_code ? e.outlet_code : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.outlet_name ? e.outlet_name : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.owner_name ? e.owner_name : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.phone ? e.phone : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.address ? e.address : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.is_account_form_uploaded != null ? e.is_account_form_uploaded : "No"); col_add++;
            worksheet.cell(row, col + col_add).string(e.phase_name ? e.phase_name : ''); col_add++;
            row++;
        }
        workbook.write(process.env.PUBLIC_URL + 'kyc_docs/KYC_List_(' + today + ').xlsx');
        const fileName = "kyc_docs/KYC_List_(" + today + ").xlsx";
        await timeout(5000);
        const url = generateBlobDownloadURL(fileName);
        res.send(sendApiResult(true, "Outlet Documents", url));
    } catch (error) {
        res.status(500).send(sendApiResult(false, error.message));
    }
}

exports.getOutletStatus = async (req, res) => {
    try {
        const outlet_id = req.params.outlet_id;
        const status = await Kyc.getOutletStatus(outlet_id);
        res.status(200).send(status);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getKycAndDocStatus = async (req, res) => {
    try {
        const outlet_id = req.params.outlet_id;
        const status = await Kyc.getKycAndDocStatus(outlet_id);
        res.status(200).send(status);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getKycTitleForFi = async (req, res) => {
    try {
        const title = await Kyc.getKycTitleForFi(req.body);
        res.status(200).send(title);

    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }

}
exports.getScopeOutlets = async (req, res) => {
    try {
        const outlets = await Kyc.getScopeOutlets(req);
        res.status(200).send(outlets);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.downloadScopeOutlets = async (req, res) => {
    try {
        var dpids = req.body.dpids;
        var dhId = req.body.dhId;
        var filterText = req.body.filterText;
        var data = await knex("cr_retail_limit")
            .select(
                // "cr_retail_limit.id",
                knex.raw("distributorspoint.name as dp_name"),
                "cr_retail_limit.outlet_code",
                "cr_retail_limit.outlet_name",
                "cr_retail_limit.owner_name",
                "cr_retail_limit.phone",
                "cr_retail_limit.address",
                "cr_retail_phase.name AS phase_name",
            )
            .leftJoin("distributorspoint", "distributorspoint.id", "cr_retail_limit.id_point")
            .leftJoin("cr_retail_phase", "cr_retail_phase.id", "cr_retail_limit.phase_id")
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
            .where("cr_retail_limit.activation_status", "Active");

        let header = [
            { header: 'SN', key: 'sn', width: 10 },
            { header: 'Point', key: 'dp_name', width: 16 },
            { header: 'Outlet Code', key: 'outlet_code', width: 13 },
            { header: 'Outlet Name', key: 'outlet_name', width: 33 },
            { header: 'Owner Name', key: 'owner_name', width: 27 },
            { header: 'Phone', key: 'phone', width: 17 },
            { header: 'Address', key: 'address', width: 34 },
            { header: 'Phase Name', key: 'phase_name', width: 12 },
        ]


        fileName = `generatedExcelFromDT/Scoped_Outlets_${moment(new Date(), "DD-MM-YYYY").format('YYYY-MM-DD__hh_mm')}.xlsx`;

        let options = {
            'addSerialNumber': true,
        };

        createExcle(header, process.env.PUBLIC_URL + "" + fileName, data, options);

        await timeout(1500);

        const url = generateBlobDownloadURL(fileName)

        res.send(sendApiResult(true, "File Generated", url));
    } catch (error) {

    }
}

exports.deleteScopeOutlet = async (req, res) => {
    try {
        const deleteScope = await Kyc.deleteScopeOutlet(req.body);
        res.status(200).send(deleteScope);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.kycStatusCounter = async (req, res) => {
    try {
        const count = await Kyc.kycStatusCounter(req.body);
        res.status(200).send(count);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.uploadAccountForm = async (req, res) => {
    try {
        const outlet_code = req.body.outlet_code;
        const titles = req.body.titles;
        const created_by = req.body.created_by;
        const id_outlet = req.body.id_outlet;
        var oldPath = process.env.PUBLIC_URL + 'outlet_documents/';
        var newPath = process.env.PUBLIC_URL + 'outlet_documents/' + outlet_code + "/";
        if (req.files.length > 0) {
            req.files.forEach((e, i) => {
                console.log(e.originalname);
                fs.rename(oldPath + e.originalname, newPath + req.body.names[i], function (err) {
                    if (err) console.log(err)
                    console.log('Successfully renamed - AKA moved!')
                })
            })
        }
        var accountFormUpload = await Kyc.uploadAccountForm(outlet_code, titles, req.body.names, created_by, id_outlet);
        res.status(200).send(accountFormUpload);
    }
    catch (error) {
        // res.send(sendApiResult(false, error.message));
        console.log('KYC Controller - function name uploadAccountForm: ' + error.message);
    }
}
exports.rejectKyc = async (req, res) => {
    try {
        var reject = await Kyc.rejectKyc(req.body);
        res.status(200).send(reject);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.fiBulkUpload = async (req, res) => {

    try {
        const dest = process.env.PUBLIC_URL + "fi_uploaded_temp_files";
        const fileName = req.file.filename;
        var files = await decompress(dest + "/" + fileName, dest);
        var fi_upload = JSON.parse(req.body.fi_upload);

        var rejected_outlet = [];
        var unique_outlet = [];
        var all_outlets = {};
        var created_by = req.body.created_by;
        console.log('1')
        await fs.unlink(dest + "/" + fileName, function (err) {
            console.log('2')
            if (err && err.code == "ENOENT") {
                // file doens't exist
                console.info("File doesn't exist, won't remove it.");
            } else if (err) {
                // other errors, e.g. maybe we don't have enough permission
                console.error("Error occurred while trying to remove file");
            } else {
                console.info(`removed`);
                //  var fi_uploaded = 
                fs.readdir(dest + "/", async (err, files) => {
                    files.forEach(file => {
                        var file_arr = file.split("_");
                        if (!unique_outlet.includes(file_arr[0])) {
                            unique_outlet.push(file_arr[0]);
                        }
                    });
                    console.log(unique_outlet);

                    if (unique_outlet.length > 0) {
                        unique_outlet.forEach(e => {

                            for (var i = 0; i < fi_upload.length; i++) {
                                var x = fi_upload[i];

                                if (files.some(res => res.includes(e + "_" + x.file_prefix))) {
                                    var filename = files[files.findIndex(element => element.includes(e + "_" + x.file_prefix))];
                                    var doc_id = x.id;
                                    if (e in all_outlets) {
                                        all_outlets[e][doc_id] = filename;
                                    } else {

                                        all_outlets[e] = {};
                                        all_outlets[e][doc_id] = filename;
                                    }
                                } else {
                                    rejected_outlet.push(e);
                                }
                            }


                        })
                    }

                    var permitted_outlets = unique_outlet.filter(function (x) {
                        return rejected_outlet.indexOf(x) < 0;
                    });

                    if (permitted_outlets.length > 0) {
                        permitted_outlets.forEach(e => {
                            for (var i = 0; i < fi_upload.length; i++) {
                                var x = fi_upload[i];
                                var file_to_move = all_outlets[e][x.id];
                                var oldPath = process.env.PUBLIC_URL + 'fi_uploaded_temp_files/' + file_to_move;
                                var newPath = process.env.PUBLIC_URL + e + "/" + file_to_move;
                                var dir = process.env.PUBLIC_URL + 'outlet_documents/' + e;
                                console.log(dir)
                                if (!fs.existsSync(dir)) {
                                    fs.mkdirSync(dir);
                                }
                                fs.renameSync(oldPath, newPath, function (err) {
                                    if (err) console.log(err)
                                    console.log('Successfully renamed - AKA moved!')

                                })
                            }
                        })
                    }

                    var bulk = await Kyc.fiBulkUpload(permitted_outlets, rejected_outlet, all_outlets, created_by);
                    // temp zip delete code
                    // fs.readdir(dest+"/",async (err, files2) => {
                    //     console.log(files2)
                    //     files2.forEach(file=>{
                    //         fs.unlink(dest + "/" + file, err => {
                    //             if (err) throw err;
                    //         });
                    //     })
                    // });

                    res.status(200).send(bulk);
                });


            }


        });
    } catch (error) {
        res.send(sendApiResult(false, "Could not Upload Fi Documents"));
    }

    //  
}

exports.getComparison = async (req, res) => {
    try {
        const result = await Kyc.getComparison(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getComparisonDownload = async (req, res) => {
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
        if (!statusToCheck.includes(req.body.status)) {
            sql += ` t2.credit_amount bat_mod_app_amt,
            t3.credit_amount fi_approved_amt`;
        } else {
            sql += ` t3.credit_amount bat_mod_app_amt`;
        }
        sql += ` FROM
        ( SELECT * FROM cr_retail_limit_log_details WHERE id_cr_retail_limit_log = ( SELECT min( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.body.id} ) ) AS t1,`;
        if (!statusToCheck.includes(req.body.status)) {
            sql += ` (
            SELECT
            * 
            FROM
            cr_retail_limit_log_details 
            WHERE
            id_cr_retail_limit_log > ( SELECT min( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.body.id} ) 
            AND id_cr_retail_limit_log < ( SELECT max( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.body.id} ) 
            AND id_cr_limit_info = ${req.body.id}
            ) AS t2,`;
        }
        sql += ` ( SELECT * FROM cr_retail_limit_log_details WHERE id_cr_retail_limit_log = ( SELECT max( id_cr_retail_limit_log ) FROM cr_retail_limit_log_details WHERE id_cr_limit_info = ${req.body.id} ) ) AS t3

        WHERE 1=1`;
        if (!statusToCheck.includes(req.body.status)) {
            sql += ` AND t1.outlet_code = t2.outlet_code`;
        }
        sql += ` AND t1.outlet_code = t3.outlet_code`;
        if (!statusToCheck.includes(req.body.status)) {
            sql += ` AND (t1.credit_amount != t3.credit_amount OR t1.credit_amount != t2.credit_amount  OR t2.credit_amount != t3.credit_amount)`;
        } else {
            sql += ` AND (t1.credit_amount != t3.credit_amount)`;
        }
        sql += ` ) as tdata`;
        const comp_data = await knex(knex.raw(sql));
        var headers = ["Outlet Code", "Outlet Name", "Owner Name", "Pnone", "Address", "Acc No.", "Fi Initial Amount", "BAT Modify / Approve Amount", "FI Approved Amount"];
        var workbook = new excel.Workbook();
        var worksheet = workbook.addWorksheet('Sheet 1');
        var headerStyle = workbook.createStyle({
            fill: {
                type: 'pattern',
                patternType: 'solid',
                bgColor: '#E1F0FF',
                fgColor: '#E1F0FF',
            },
            font: {
                color: "#000000",
                size: "10",
                bold: true
            }
        })
        var col = 1;
        var row = 1;
        var col_add = 0;
        headers.forEach(e => {
            worksheet.cell(row, col + col_add).string(e).style(headerStyle);
            col_add++;
        });
        row++;
        for (let i = 0; i < comp_data.length; i++) {
            var col_add = 0;
            let e = comp_data[i];
            worksheet.cell(row, col + col_add).string(e.outlet_code ? e.outlet_code : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.outlet_name ? e.outlet_name : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.owner_name ? e.owner_name : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.phone ? e.phone : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.address ? e.address : ''); col_add++;
            worksheet.cell(row, col + col_add).string(e.acc_no ? e.acc_no : ''); col_add++;
            worksheet.cell(row, col + col_add).number(e.fi_init_amt ? e.fi_init_amt : ''); col_add++;
            worksheet.cell(row, col + col_add).number(e.bat_mod_app_amt ? e.bat_mod_app_amt : ''); col_add++;
            if (typeof e.fi_approved_amt !== 'undefined') {
                worksheet.cell(row, col + col_add).number(e.fi_approved_amt ? e.fi_approved_amt : ''); col_add++;
            }
            row++;
        }
        workbook.write(process.env.PUBLIC_URL + 'samples/scop_outlets_comparisons.xlsx');
        const fileName = "samples/scop_outlets_comparisons.xlsx";
        const url = generateBlobDownloadURL(fileName);
        await timeout(1500);
        res.send(sendApiResult(true, "Comparison File Generated", url));
    } catch (error) {
        console.log(error.message)
    }
}

exports.mobileNoCheck = async (req, res) => {
    try {
        var result = await Kyc.mobileNoCheck(req.params.mobile_no, req.params.id_outlet);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.sendSms = async (req, res) => {
    try {
        console.log(req.body)
        const task = req.body.task;
        const lang = req.body.language;
        switch (task) {
            case 'kyc-verification':
                await sendOtp(req.body, res, lang);
                break;
            case 'payment-confirmation':
                await sendOtp(req.body, res, lang);
                break;

            default:
                break;
        }
        const result = true;

    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

const sendOtp = async function (req, res, lang) {
    const sys_date = moment(new Date()).format("YYYY-M-DD");
    const mobile_no = '88' + req.mobile_no;
    var msg = "";
    if (req.task == 'payment-confirmation') {
        msg =
            moment(new Date()).format('DD-MMM-YYYY') +
            ", আজকের দিনের জন্য আপনার, ক্যাশ পেমেন্ট:" +
            req.cash_payment +
            ", ক্রেডিট গ্রহণ:" +
            req.credit_taken +
            ", ক্রেডিট পেমেন্ট:" +
            req.credit_payment +
            ", মোট বকেয়া:" +
            req.total_due +
            " সকল তথ্য ঠিক থাকলে ৬ সংখ্যার নম্বরটি এস.আর কে বলুন, OTP:"
            + req.otp;

        if (lang == 'en') {
            msg =
                moment(new Date()).format('DD MMM YYYY') +
                ", as of today Cash paid: " +
                req.cash_payment +
                " Credit received: " +
                req.credit_taken +
                " Credit paid: " +
                req.credit_payment +
                " Total due: " +
                req.total_due +
                " If OK please tell the OTP to SR. OTP: " +
                req.otp;
            //msg = "02 Feb 2021, as of today Cash paid: 12345.00 Credit received: 12345.00 Credit paid: 12345.00 Total due: 12345.00 If OK please tell the OTP to SR. OTP: 123456";
        }

    } else if (req.task == 'kyc-verification') {
        msg = "আপনার প্রদত্ত মোবাইল নাম্বারটি যাচাই করতে এই ওটিপি-টি আপনার এসএস কে বলুন, ওটিপি: " + req.otp;

        if (lang == 'en') {
            msg = "Please provide the following OTP to your SS for mobile number verification. OTP: " + req.otp;
            console.log('Eng SMS block');
        }
    }
    // console.log("Before Save OTP Log Function");    
    // console.log(msg);
    const otp_log_id = await saveOtpLog(req, sys_date, msg); //  to save OTP Log

    try {
        var gateway_info = await knex("cr_sms_gateway").select("name").where("status", 1).first();
        var gateway_name = gateway_info.name;
        switch (gateway_name) {
            case 'infobip':
                await sendSms_infobip(otp_log_id, mobile_no, msg);
                break;
            case 'elitbuzz':
                await sendSms_elitbuzz(otp_log_id, mobile_no, msg);
                break;
            default:
                break;
        }
        res.json({ result: 'success', message: 'SMS Send successfully' });
    } catch (e) {
        console.log(e.name);    // logs 'Error'
        console.log(e.message); // logs 'The message', or a JavaScript error message
        console.log('OTP Send Failed');
    }
}

const sendSms_infobip = async function (otp_log_id, mobile_no, msg) {
    var https = require('follow-redirects').https;
    var options = {
        'method': 'POST',
        'hostname': 'r5k23y.api.infobip.com',
        'path': '/sms/2/text/advanced',
        'headers': {
            'Authorization': 'App e6fb427be474c3616b1f491aa8e64c29-a564d9e2-8d63-4f5c-8488-3e3c2891cbec',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        'maxRedirects': 20
    };
    var req = https.request(options, function (res) {
        var chunks = [];
        res.on("data", function (chunk) {
            chunks.push(chunk);
        });
        res.on("end", function (chunk) {
            var body = Buffer.concat(chunks);
            // console.log(body.toString());
            var sms_gateway_response = JSON.parse(body.toString());
            // console.log("sms_response: ", sms_gateway_response);
            if (sms_gateway_response.requestError != undefined && sms_gateway_response.requestError !== null) {
                console.error(sms_gateway_response.requestError.serviceException.text);
            } else {
                gateway_status = sms_gateway_response.messages[0].status;
                gateway_msg_id = sms_gateway_response.messages[0].messageId;
                var updateData = {
                    otp_log_id: otp_log_id,
                    gateway_status: JSON.stringify(gateway_status),
                    otp_status: 'success',
                    gateway_name: 'infobip',
                    gateway_msg_id: gateway_msg_id
                };
                updateOtpLog(updateData);
                console.log('OTP Send from infobip');
            }
        });
        res.on("error", function (error) {
            console.error(error);
        });
    });

    var postData = JSON.stringify({ "messages": [{ "from": "InfoSMS", "destinations": [{ "to": '"' + mobile_no + '"' }], "text": msg, "languageCode": "AUTODETECT" }] });
    req.write(postData);
    req.end();
}

const sendSms_elitbuzz = async function (otp_log_id, mobile_no, msg) {

    const data = {};
    data['api_key'] = 'R600152361c19db0c23837.72178419';
    data['type'] = 'text';
    data['contacts'] = mobile_no;
    data['senderid'] = '8809612436141';
    data['msg'] = msg;

    axios.post('http://72.52.251.162/one2one/unnoti/send_sms/',
        {
            url: 'https://msg.elitbuzz-bd.com/smsapi/',
            data: data
        })
        .then(function (response) {
            var gateway_msg_id = response.data; // OTP message ID
            var gateway_status = { 'status': response.status, 'statusText': response.statusText, 'msg_id': response.data };
            var updateData = {
                otp_log_id: otp_log_id,
                gateway_status: JSON.stringify(gateway_status),
                otp_status: 'success',
                gateway_name: 'elitbuzz',
                gateway_msg_id: gateway_msg_id
            };
            updateOtpLog(updateData);
            console.log('OTP Send from elitbuzz');
        })
        .catch(function (error) {
            console.log('Error block');
            console.log(error);
        });
}

async function saveOtpLog(req, sys_date, msg_body) {
    var outlet_code = null;
    if (req.outlet_code == undefined) {
        if (req.outlet_id != undefined) {
            outlet_info = await knex("retailers").select("retailers.retailer_code AS retailer_code").where("retailers.id", req.outlet_id).first();
            outlet_code = outlet_info.retailer_code;
        }
    }
    var insertData = {
        sys_date: sys_date,
        user_id: (req.user_id != undefined) ? req.user_id : null,
        outlet_code: (req.outlet_code != undefined) ? req.outlet_code : outlet_code,
        id_outlet: (req.outlet_id != undefined) ? req.outlet_id : null,
        task: req.task,
        mobile_no: req.mobile_no,
        otp: req.otp,
        sms_via: 'server',
        msg_body: msg_body
    };
    const otp_saved_log = await knex("cr_otp_log").insert(insertData).returning('id');
    console.log("OTP log saved Successful.");
    return otp_saved_log[0];
}

async function updateOtpLog(updateData) {
    const update_otp_log = await knex("cr_otp_log")
        .where("id", updateData.otp_log_id)
        .update({
            'gateway_status': updateData.gateway_status,
            'otp_status': updateData.otp_status,
            'gateway_msg_id': updateData.gateway_msg_id,
            'gateway_name': updateData.gateway_name
        });

    if (update_otp_log) {
        console.log("OTP log Updated Successfuly.");
    }
}

exports.sendMultipleSms = async function (mobile_no) {

    var msg = "অভিনন্দন! আপনি " + moment(new Date()).format('DD-MMM-YYYY') + " থেকে উন্নতি-এর লোন সুবিধা নিতে পারবেন।";

    console.log(msg);
    var https = require('follow-redirects').https;
    var options = {
        'method': 'POST',
        'hostname': 'r5k23y.api.infobip.com',
        'path': '/sms/2/text/advanced',
        'headers': {
            'Authorization': 'App e6fb427be474c3616b1f491aa8e64c29-a564d9e2-8d63-4f5c-8488-3e3c2891cbec',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        'maxRedirects': 20
    };
    var req = https.request(options, function (res) {
        var chunks = [];
        res.on("data", function (chunk) {
            chunks.push(chunk);
        });
        res.on("end", function (chunk) {
            var body = Buffer.concat(chunks);
            console.log(body.toString());
        });
        res.on("error", function (error) {
            console.error(error);
        });
    });
    var postData = JSON.stringify({ "messages": [{ "from": "InfoSMS", "destinations": [{ "to": '"' + mobile_no + '"' }], "text": msg, "languageCode": "AUTODETECT" }] });
    console.log(postData);
    req.write(postData);
    req.end();
    res.json({ result: 'success', message: 'SMS Send successfully' });
}

exports.SmsGatewayList = async (req, res) => {
    try {
        var result = await Kyc.getSmsGaetwayList(req);
        if (result) {
            res.status(200).send(result);
        } else {
            res.send(sendApiResult(false, "No gateway found"));
        }
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.changeSmsGateway = async (req, res) => {
    try {
        const activeGateway = req.body.active_gateway;
        if (activeGateway) {
            var result = await Kyc.changeSmsGateway(req);
            res.status(200).send(result);
        } else {
            res.send(sendApiResult(false, "No gateway found"));
        }
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getNidInfo = async (req, res) => {
    try {
        var result = await Kyc.getNidInfo(req.params.retailer_id);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.postNidInfo = async (req, res) => {
    try {
        var result = await Kyc.postNidInfo(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.kycDocumentStatus = async (req, res) => {
    try {
        var result = await Kyc.kycDocumentStatus(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.kycDocumentStatusByPoint = async (req, res) => {
    try {
        var result = await Kyc.kycDocumentStatusByPoint(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.updateDocReady = async (req, res) => {
    try {
        var result = await Kyc.updateDocReady(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.updateOtpVerification = async (req, res) => {
    try {
        var result = await Kyc.updateOtpVerification(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.retailerNidInformation = async (req, res) => {
    try {
        var result = await Kyc.retailerNidInformation(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
};

exports.pendingLoanCustomerId = async (req, res) => {
    try {
        var result = await Kyc.pendingLoanCustomerId(req.query);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
};

exports.loanCustomerIdAdjustment = async (req, res) => {
    try {
        var result = await Kyc.loanCustomerIdAdjustment(req.query);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
};

exports.uploadRetailerPhoneNumberChangeSingle = async (req, res) => {
    try {
        const result = await Kyc.uploadRetailerPhoneNumberChangeSingle(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.fetchPorichoyPdfImage = async (req, res) => {
    try {
        var result = await Kyc.fetchPorichoyPdfImage(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.downloadNidBulk = async (req, res) => {
    try {

        const outlet_codes = req.body.outlet_codes;
        console.log(outlet_codes);
        var downloadName = await saveZipMultipleFolder(outlet_codes, "unnoti_outlet_documents", "zip_outlet_document");
        if (!downloadName) {
            res.send(sendApiResult(false, "no nids found",));
        }
        const url = generateBlobDownloadURL("zip_outlet_document" + "/" + downloadName);
        res.status(200).send(sendApiResult(true, "File name ", url));
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}