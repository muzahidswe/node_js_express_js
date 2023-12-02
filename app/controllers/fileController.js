const fs = require('fs');
const express = require('express');
const readXlsxFile = require('read-excel-file/node');
const { sendApiResult, uploaddir } = require('./helperController');
const FileModel = require("../Models/FileModel");
const xlsx = require('xlsx')
var moment = require('moment');

exports.uploadScopOutletsFile = async (req, res) => {
    const upload = await importScopeOutlets2DB(req.file.filename, req.body);
    res.status(200).send(upload);
}

exports.uploadRetailerPhoneNumberChangeBulk = async (req, res) => {
    const upload = await importRetailerPhoneNumberChangeData2DB(req.file.filename, req.body);
    res.status(200).send(upload);
}

exports.uploadXlFile = async (req, res) => {
    var start = moment(req.body.effective_date, "YYYY-MM-DD");
    var end = moment(new Date(req.body.duration.split("-")[0], parseInt(req.body.duration.split("-")[1]), 0), "YYYY-MM-DD");
    var duration = moment.duration(end.diff(start)).asDays();
    if (duration < 0) {
        res.json({
            "success": false,
            'msg': 'Duration cannot be shorter than Effective date.'
        });
    }
    else {
        const upload = await importExcelData2DB(req.file.filename, req.body);
        res.status(200).send(upload);
        // res.json({
        //     "success": true,
        //     'msg': 'File uploaded/imported successfully!', 'file': req.file
        // });
    }
}

exports.uploadInterestSettingsFile = async (req, res) => {
    const upload = await importInterestSettingsData2DB(req.file.filename, req.body);
    res.status(200).send(upload);
}

const importScopeOutlets2DB = async function (filePath, req) {
    try {
        var resData = [];
        var workbook = xlsx.readFile(`${process.env.PUBLIC_URL}scope_outlets/` + filePath, { type: "array" });
        const sheetnames = Object.keys(workbook.Sheets);
        let i = sheetnames.length;
        while (i--) {
            const sheetname = sheetnames[i];
            arrayName = sheetname.toString();
            resData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetname]);
            var insert = await FileModel.insertScopeOutletBulk(resData, filePath, req);
        }
        return insert;
    } catch (error) {
        return sendApiResult(false, 'File not uploaded');
    }
}

const importExcelData2DB = async function (filePath, req) {
    try {
        var resData = [];
        var workbook = xlsx.readFile(`${process.env.PUBLIC_URL}uploads/` + filePath, { type: "array" });
        const sheetnames = Object.keys(workbook.Sheets);
        let i = sheetnames.length;
        while (i--) {
            const sheetname = sheetnames[i];
            arrayName = sheetname.toString();
            resData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetname]);
            var insert = await FileModel.insertBulk(resData, filePath, req);
        }
        return insert;
    } catch (error) {
        return sendApiResult(false, 'File not uploaded');
    }
}

exports.uploadBulkKYCApproveFile = async (req, res) => {
    const upload = await importBulkKYCApprove2DB(req.file.filename, req.body);
    res.status(200).send(upload);
}

const importBulkKYCApprove2DB = async function (filePath, req) {
    try {
        var resData = [];
        var workbook = xlsx.readFile(`${process.env.PUBLIC_URL}kyc_bulk_upload/` + filePath, { type: "array" });
        const sheetnames = Object.keys(workbook.Sheets);
        let i = sheetnames.length;
        while (i--) {
            const sheetname = sheetnames[i];
            arrayName = sheetname.toString();
            resData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetname]);
            var insert = await FileModel.insertBulkKYCApprove(resData, filePath, req);
        }
        return insert;
    } catch (error) {
        return sendApiResult(false, 'File not uploaded');
    }
}

exports.uploadOutletDetailsInfoFile = async (req, res) => {
    const upload = await importOutletDetailsInfo2DB(req.file.filename, req.body);
    res.status(200).send(upload);
}

const importOutletDetailsInfo2DB = async function (filePath, req) {
    try {
        var resData = [];
        var workbook = xlsx.readFile(`${process.env.PUBLIC_URL}outlet_documents/outlet_nid_info/` + filePath, { type: "array" });
        const sheetnames = Object.keys(workbook.Sheets);
        let i = sheetnames.length;
        while (i--) {
            const sheetname = sheetnames[i];
            arrayName = sheetname.toString();
            resData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetname]);
            var insert = await FileModel.insertOutletDetailsInfo(resData, filePath, req);
        }
        return insert;
    } catch (error) {
        return sendApiResult(false, 'File not uploaded');
    }
}

const importInterestSettingsData2DB = async function (filePath, req) {
    try {
        var resData = [];
        var workbook = xlsx.readFile(`${process.env.PUBLIC_URL}interest_settings/` + filePath, { type: "array" });
        const sheetnames = Object.keys(workbook.Sheets);
        let i = sheetnames.length;
        while (i--) {
            const sheetname = sheetnames[i];
            arrayName = sheetname.toString();
            resData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetname]);
            console.log(resData);

            var insert = await FileModel.insertInterestSettingsBulk(resData, filePath, req);
        }
        return insert;
    } catch (error) {
        return sendApiResult(false, 'File not uploaded');
    }
}

const importRetailerPhoneNumberChangeData2DB = async function (filePath, req) {
    try {
        var resData = [];
        var workbook = xlsx.readFile(`${process.env.PUBLIC_URL}retailer_phone_number_change/` + filePath, { type: "array" });
        const sheetnames = Object.keys(workbook.Sheets);
        let i = sheetnames.length;
        while (i--) {
            const sheetname = sheetnames[i];
            arrayName = sheetname.toString();
            resData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetname]);
            console.log(resData);

            var insert = await FileModel.retailerPhoneNumberChangeBulk(resData, filePath, req);
        }
        return insert;
    } catch (error) {
        return sendApiResult(false, 'File not uploaded');
    }
}
