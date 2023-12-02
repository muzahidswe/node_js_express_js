const { sendApiResult } = require("./helperController");
const support = require("../Models/SupportModel");

exports.supportOutletList = async (req, res) =>{
    try {
        const result = await support.supportOutletList();
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
};

exports.updateOutletInfo = async (req, res) => {
	try {
		var result = await support.updateOutletInfo(req.body);
		res.status(200).send(result);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.deleteOutletDisbursement = async (req, res) => {
	try {
		var result = await support.deleteOutletDisbursement(req.body);
		res.status(200).send(result);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.deleteOutletPayment = async (req, res) => {
	try {
		var result = await support.deleteOutletPayment(req.body);
		res.status(200).send(result);
	} catch (error) {
		res.send(sendApiResult(false, error.message));
	}
};

exports.supportCreditOutletList = async (req, res) =>{
    try {
        const result = await support.supportCreditOutletList();
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
};

exports.OtpCheckLog = async (req, res) =>{
    try {
        const result = await support.OtpCheckLog();
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
};

exports.otpLog = async (req,res) =>{
    try { 
        const result = await support.OtpLogUpdate(req.body.data);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
};