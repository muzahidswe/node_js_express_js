const { sendApiResult } = require("./helperController")
const settlementModel = require("../Models/SettlementModel");

exports.getCreditListForDisbursement = async (req, res) => {
    try {
        const result = await settlementModel.getCreditListForDisbursement(req.body);
        result.total_amount = result.data.total_amount;
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.creditDisbursementRequestByDh = async (req, res) => {
    try {
        const result = await settlementModel.creditDisbursementRequestByDh(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.requestedDisbursementsByDh = async (req, res) => {
    try {
        const result = await settlementModel.requestedDisbursementsByDh(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getCreditListForFiDisbursement = async (req, res) => {
    try {
        const result = await settlementModel.getCreditListForFiDisbursement(req.body);
        result.total_amount = result.data.total_amount;
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getTransactionDisbursementDetails = async (req, res) => {
    try {
        const result = await settlementModel.getTransactionDisbursementDetails(req.body);
        result.total_amount = result.data.total_amount;
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.raiseDhIssue = async (req, res) => {
    try {
        const result = await settlementModel.raiseDhIssue(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.creditDisburseByFi = async (req, res) => {
    try {
        const result = await settlementModel.creditDisburseByFi(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.creditRejectByFi = async (req, res) => {
    try {
        const result = await settlementModel.creditRejectByFi(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.collectionSettlementListForDh = async (req, res) => {
    try {
        const result = await settlementModel.collectionSettlementListForDh(req.body);
        result.total_amount = result.data.total_amount;
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.collectionSettlementRequestByDh = async (req, res) => {
    try {
        const result = await settlementModel.collectionSettlementRequestByDh(req);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.requestedCollectionsByDh = async (req, res) => {
    try {
        const result = await settlementModel.requestedCollectionsByDh(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.collectionSettlementListForFi = async (req, res) => {
    try {
        const result = await settlementModel.collectionSettlementListForFi(req.body);
        result.total_amount = result.data.total_amount;
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.collectionSettlementConfirmByFi = async (req, res) => {
    try {
        const result = await settlementModel.collectionSettlementConfirmByFi(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.collectionSettlementRejectFi = async (req, res) => {
    try {
        const result = await settlementModel.collectionSettlementRejectFi(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getCollectionSettlementDetails = async (req, res) => {
    try {
        const result = await settlementModel.getCollectionSettlementDetails(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.raisedIssues = async (req, res) => {
    try {
        const result = await settlementModel.raisedIssues(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.resolveIssue = async (req, res) => {
    try {
        const result = await settlementModel.resolveIssue(req.body);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}

exports.getDhAccNo = async (req, res) => {
    try {
        const result = await settlementModel.getDhAccNo(req.params.id);
        res.status(200).send(result);
    } catch (error) {
        res.send(sendApiResult(false, error.message));
    }
}