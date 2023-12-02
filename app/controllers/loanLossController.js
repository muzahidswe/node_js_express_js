const knex = require('../config/database')
const { sendApiResult } = require('./helperController')
const loanLossModel = require('../Models/loanLossModel')

exports.determindClassificationWiseOutlets = async (req, res) => {
  try {
    const loanLossCalculation = await loanLossModel.determindClassificationWiseOutlets()
    res.status(200).send(loanLossCalculation)
  } catch (error) {
    res.send(sendApiResult(false, error.message))
  }
}
exports.outletLoanLossData = async (req, res) => {
  try {
    const loanLossCalculation = await loanLossModel.outletLoanLossData(req.body)
    res.status(200).send(loanLossCalculation)
  } catch (error) {
    res.send(sendApiResult(false, error.message))
  }
}
exports.outletLoanLossReport = async (req, res) => {
  try {
    const loanLossCalculation = await loanLossModel.outletLoanLossReport(req.body)
    res.status(200).send(loanLossCalculation)
  } catch (error) {
    res.send(sendApiResult(false, error.message))
  }
}
exports.summeryOfOutletLoanLossData = async (req, res) => {
  try {
    const loanLossCalculation = await loanLossModel.summeryOfOutletLoanLossData(req.body)
    res.status(200).send(loanLossCalculation)
  } catch (error) {
    res.send(sendApiResult(false, error.message))
  }
}
