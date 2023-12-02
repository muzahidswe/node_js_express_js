const { sendApiResult } = require("./helperController");
const cblModel = require("../Models/CblIntegrationModel");

exports.changeDrawdownStatus = async (req, res) => {
    const output = {
        ack_status: req.body.ack_status,
        message: req.body.ack_status == 200 ? req.body.message : 'Failed'
    };
    try {               
        const changeDrawdownStatus = await cblModel.changeDrawdownStatus(req.body);
        res.status(200).send(output);
    } catch (error) {
        res.send(sendApiResult(false,error.message));
    }
}

exports.receiveEodTotal = async (req, res) => {
    const output = {
        ack_status: 200,
        message: 'Success'
    };
    try {               
        const receiveEodTotal = await cblModel.receiveEodTotal(req.body);
        res.status(200).send(output);
    } catch (error) {
        output.ack_status = 400;
        output.message = 'Failed';
        console.log(error.message);
        res.status(output.ack_status).send(output);
    }
}

exports.receiveDisbursementsDetails = async (req, res) => {
    const output = {
        ack_status: 200,
        message: 'Success'
    };
    try {               
        const receiveDisbursementsDetails = await cblModel.receiveDisbursementsDetails(req.body);
        res.status(200).send(output);
    } catch (error) {
        output.ack_status = 400;
        output.message = 'Failed';
        console.log(error.message);
        res.status(output.ack_status).send(output);
    }
}

exports.receiveRepayment = async (req, res) => {
    const output = {
        ack_status: 200,
        message: 'Success'
    };
    try {               
        const receiveRepayment = await cblModel.receiveRepayment(req.body);
        res.status(200).send(output);
    } catch (error) {
        output.ack_status = 400;
        output.message = 'Failed';
        console.log(error.message);
        res.status(output.ack_status).send(output);
    }
}