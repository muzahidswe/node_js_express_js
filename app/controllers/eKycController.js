const {
	sendApiResult,
	saveZip,
	saveZipFolder,
	saveZipMultipleFolder,
	generaeteExcel,
	timeout
} = require("./helperController");
const eKyc = require("../Models/eKycModel");
const knex = require("../config/database");
const excel = require("excel4node");
const { title } = require("process");
var moment = require("moment");

exports.nidInfoChecking = async (req, res) => {
	try {
		const result = await eKyc.nidInfoChecking(req.body);
		res.status(200).send(result);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.nidInfoDetails = async(req, res) => {
    try {
        const id = req.params.id;
        const status = await eKyc.nidInfoDetails(id);
        res.status(200).send(status);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
};

exports.nidInfoList = async (req, res) => {
	try {
		const result = await eKyc.nidInfoList(req.body);
		res.status(200).send(result);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.downloadeKycOutletList = async (req, res) => {
	try {
		const result = await eKyc.downloadeKycOutletList(req.body);
		res.status(200).send(result);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};
