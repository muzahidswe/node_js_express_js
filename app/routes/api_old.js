
const express = require('express');
const router = express.Router();
const multer = require('multer');

const user = require("../controllers/user");
const auth = require("../controllers/auth");
const fi = require("../controllers/fiController");
const file = require("../controllers/fileController");
const { uploaddir, 
    fileUploadConfig, 
    uploadRetailerDocsConfig, 
    fiLogoUpload, 
    fileUploadConfigTnx,
    scopeOutletUpload,
    uploadAccountFormsConfig,
    uploadBulkFormConfig,
    DynamicFileUploadConfig,
    docSubmittedUpload,
    fileUploadReviewOldCredit
} = require('../controllers/helperController');
const kyc = require("../controllers/kycController");
const interest = require("../controllers/interestController");
const disbursement = require("../controllers/disbursementController");
const settlement = require("../controllers/settlementController");
const salesReport = require("../controllers/salesReportController");
const bank = require("../controllers/BankController");
const interestCalculation = require("../controllers/interestCalculationController");
const report = require("../controllers/reportController");
const cc = require("../controllers/creditController");
const dashboard = require("../controllers/dashboardController");
const billing = require("../controllers/billingController");
const support = require("../controllers/supportController");

const uploadAccountForm = multer({
  storage:uploadAccountFormsConfig()
})

const uploadReviewOldCredit = multer({
  storage: fileUploadReviewOldCredit('file')
});


const upload = multer({
    storage: fileUploadConfig('credit_file')
});

const uploadTnx = multer({
    storage: fileUploadConfigTnx('credit_file')
});

const uploadFiLogo = multer({
    storage: fiLogoUpload('credit_file')
});

const uploadScopeOutlets = multer({
    storage: scopeOutletUpload('credit_file')
});

const uploadDocSubmitted = multer({
    storage: docSubmittedUpload('credit_file')
});

const uploadRetailerDoc= multer({
  storage:uploadRetailerDocsConfig("outlet_documents")
});

const uploadZip =  multer({
  storage:uploadRetailerDocsConfig("account_form")
});
const dh = require("../controllers/dhController");

const uploadZipForm = multer({
  storage:uploadBulkFormConfig("fi_uploaded_temp_files")
})

router.post("/get-dashboard-data", dashboard.getData);
router.post("/get-dashboard-data-v2", dashboard.getDataV2);

router.get("/userList", user.userList);
router.get("/user/:id", user.getUserById);
router.post("/register", auth.register);
router.post("/change-pass", user.changePass);
router.post("/create-user", user.createUser);
router.get("/user-delete/:id", user.userDelete);
router.post(
    "/insert-fi-institute",
    uploadFiLogo.single("logo"),
    fi.insertFiInstitute);
router.get("/get-documents",fi.getDocuments);
router.get("/get-documents-fi-wise",fi.getDocumentsFiWise);
router.get("/delete-fi-doc-relation/:id",fi.deleteFiDocRelation);
router.get("/get-fi",fi.getFi);
router.post(
  "/upload-credit-limit-file",
  upload.single("file"),
  file.uploadXlFile
  );
router.post(
  "/upload-scope-outlets",
  uploadScopeOutlets.single("file"),
  file.uploadScopOutletsFile
  );
router.post("/deactivate-fi-transaction", fi.deactivateFiTransaction)
router.post("/activate-fi-transaction", fi.activateFiTransaction)
router.post("/post-fi-doc-mapping-url", fi.posFiDocMappingUrl)
router.post("/limit-confirmed-credits",cc.limitConfirmedCredits);
router.post("/limit-confirmed-credits-download",cc.limitConfirmedCreditsDownloads);
router.post("/credit-summary-of-outlets",cc.getCreditSummaryOfOutlets);
router.post("/credit-summary-of-outlets-download",cc.getCreditSummaryOfOutletsDownload);
router.get("/limit-confirmed-credit/:id",cc.limitConfirmedCreditById);
router.put("/limit-confirmed-credit/:id",cc.limitConfirmedCreditUpdateById);
router.get("/generate-fi-credit-upload-sample/:id",cc.generateFiCreditUploadSample);

router.post("/get-uploads",cc.getFileUploads);
router.put("/approve-credit-limit/:cr_user_type/:cr_retail_limit_info_id", cc.approveCreditLimit);
router.get("/limit-confirmed-log-details/:id",cc.limitConfirmedLogDetails);

router.get("/credit-limit-by-point/:id",cc.creditLimitByPoint);
router.put("/credit-limit-by-point/:id", cc.creditLimitUpdateByPoint);
router.delete("/credit-limit-by-point/:id",cc.creditLimitDeleteByPoint);
router.post("/credit-limit-by-point",cc.creditLimitInsert);
router.get("/scope-outlets-by-route/:id", cc.scopeOutletsByRoute);

router.post(
    "/edit-fi",
    uploadFiLogo.single("logo"),
    fi.editFi);
router.post("/delete-fi",fi.deleteFi);

router.get("/get-dh",dh.getDh);
router.post("/insert-dh-fi-mapping",fi.dhFiMapping)

router.post("/send-sms",kyc.sendSms);
router.get("/send-multi-sms/:numbers",kyc.sendMultipleSms);

router.post("/insert-outlet-doc-info",kyc.insertOutletDocInfo);
router.get("/get-document-title",kyc.getDocumentTitle);
router.post("/insert-outlet-doc-file",
    uploadRetailerDoc.array("file"),
    kyc.uploadRetailerDocuments
    );
router.get("/get-document-title/:id",kyc.getDocumentTitleDpWise);
router.get("/get-document-titles-vs-fi",kyc.getDocumentTitlesVsFi);

router.post("/get-kyc",kyc.getKyc);
router.post("/approve-all-kyc", kyc.approveAllKyc)
router.post("/get-kye-docs-not-uploaded",kyc.getKycDocsNotUploaded);
router.post("/get-kye-docs-not-uploaded-download",kyc.getKycDocsNotUploadedDownload);

router.post("/get-kye-docs-submitted",kyc.getKycDocsSubmitted);
router.post("/get-kye-docs-submitted-download",kyc.getKycDocsSubmittedDownload);

router.post("/get-kye-fi-approved",kyc.getKycFiApproved);
router.post("/get-kye-fi-approved-download",kyc.getKycFiApprovedDownload);

router.post("/get-kyc-rejected",kyc.getKycRejected);
router.post("/get-kyc-rejected-download",kyc.getKycRejectedDownload);
router.post("/get-outlet-count-based-on-doc-upload",kyc.getOutletCountBasedOnDocUpload);
router.post("/get-outlet-balance",kyc.getOutletBalance);
router.post("/download-nid-per-house",kyc.downloadNidPerHouse);
router.get("/download-nid-per-outlet/:outlet_code",kyc.downloadNidPerOutlet);

router.post("/get-location-based-on-permission",user.getLocationBasedOnPermission);
router.post("/get-location-based-on-permission-for-report",user.getLocationBasedOnPermissionForReport);
router.post("/get-locations-fi-di-wise",user.getLocationsFiDiWise);
router.post("/insert-credit-config",cc.insertCreditConfig)
router.get("/outlet-image-preview/:outlet_id",kyc.outletImagePreview);

router.get("/nid-info/:retailer_id",kyc.getNidInfo);
router.post("/nid-info/:retailer_id",kyc.postNidInfo);

router.get("/kyc-document-status/:dhrs_id/:doc_ready",kyc.kycDocumentStatus);
router.get("/update-doc-ready/:id_outlet/:status",kyc.updateDocReady);

router.get("/dhwise-filist",dh.dhWiseFiList);
router.post("/upload-application-form-zip",
    uploadZip.single('file'),
    kyc.uploadApplicationFormZip
    );
router.post('/deactivate-fi-dh-relation', dh.deactivateFiDhRelation);
router.post('/activate-fi-dh-relation', dh.activateFiDhRelation);


router.post("/cr-limit-config-list",cc.creditLimitConfigList);
router.get("/get-config/:id",cc.getConfigById);
router.post("/edit-config-limit",cc.updateConfig);
router.post("/download-modification-file",cc.downloadModificationFile);
router.post("/download-log-details",cc.downloadLogDetails);
router.post("/interest-settings",interest.insertInterestSettings);
router.post("/get-uploaded-interest-settings",interest.getUploadedInterestSettings);
router.put("/interest-settings/:id",interest.interestSettingsUpdateByPoint);
router.delete("/interest-settings/:id",interest.interestSettingsDeleteByPoint);
router.get("/interest-settings/:id",interest.interestSettingsByPoint);
router.get("/delete-cr-limit-config/:id", interest.deleteCrLimitConfig);

router.post("/download-kyc-outlet-info",kyc.downloadKycOutletInfo);
router.get("/get-outlet-credits/:dpid",cc.getOutletCredit);
router.get("/get-outlet-credits-by-outlet-id/:outletId",cc.getOutletCreditByOutletId);

router.post("/take-new-credit",disbursement.takeNewCredit);
router.post("/outlet-credit-payment",disbursement.outletCreditPayment);
router.get("/get-outlet-status/:outlet_id",kyc.getOutletStatus);
router.get("/get-kycdoc-status/:outlet_id",kyc.getKycAndDocStatus);
router.get("/mobile-no-check/:mobile_no/:id_outlet?",kyc.mobileNoCheck);
router.get("/check-todays-credit/:id_outlet?",disbursement.checkTodaysCredit);
router.get("/update-otp-verification/:id_outlet?",kyc.updateOtpVerification);

router.post("/get_kyc_title_for_fi",kyc.getKycTitleForFi);
router.post("/scope-outlets",kyc.getScopeOutlets);
router.post("/scope-outlets-download",kyc.downloadScopeOutlets);
router.post("/delete-scope-outlet",kyc.deleteScopeOutlet);
router.post("/kyc-status-counter",kyc.kycStatusCounter);
router.post("/get-comparison",kyc.getComparison);
router.post("/get-comparison-download",kyc.getComparisonDownload);

router.post("/get-credit-list-for-disbursement",settlement.getCreditListForDisbursement);
router.post("/credit-disbursement-request-by-dh",settlement.creditDisbursementRequestByDh);
router.post("/requested-disbursements-by-dh",settlement.requestedDisbursementsByDh);
router.post("/get-credit-list-for-fi-disbursement",settlement.getCreditListForFiDisbursement);
router.post("/get-transaction-disbursement-details",settlement.getTransactionDisbursementDetails);
router.post("/raise-dh-issue",settlement.raiseDhIssue);
router.post("/raised-issues",settlement.raisedIssues);
router.post("/resolve-issue",settlement.resolveIssue);
router.post(
  "/credit-disburse-by-fi",
  uploadTnx.single("file"),
  settlement.creditDisburseByFi
  );
router.post("/credit-reject-by-fi",settlement.creditRejectByFi);
router.post("/get-collection-settlement-list-for-dh",settlement.collectionSettlementListForDh);
router.post(
  "/collection-settlement-request-by-dh",
  uploadTnx.single("file"),
  settlement.collectionSettlementRequestByDh
  );
router.post("/get-collection-settlement-details",settlement.getCollectionSettlementDetails);
router.post("/requested-collections-by-dh",settlement.requestedCollectionsByDh);
router.post("/get-collection-settlement-list-for-fi",settlement.collectionSettlementListForFi);
router.post("/collection-settlement-confirm-by-fi",settlement.collectionSettlementConfirmByFi);
router.post("/collection-settlement-reject-by-fi",settlement.collectionSettlementRejectFi);
router.get("/get-dh-acc-no/:id", settlement.getDhAccNo);

// Sales report
router.get("/dh-wise-sales-report/:id/:year", salesReport.dhWiseSalesReport);


//City Bank
router.get("/dummy-city-bank", bank.giveCredit);


router.post("/upload-account-form",
    uploadAccountForm.array("files"),
    kyc.uploadAccountForm
    );

router.post("/reject-kyc",kyc.rejectKyc);
router.post("/fi-bulk-upload",
    uploadZipForm.single('file'),
    kyc.fiBulkUpload);

//router.get("/interest_calculation/:type", interestCalculation.calculateDailyInterest);

const salesUpload = multer({
    storage: DynamicFileUploadConfig('public')
});

router.post(
    "/upload-sales-file",
    salesUpload.single("file"),
    report.uploadSalesData
    );
router.post("/download-sales-report", report.downLoadSalesreport);
router.post("/disbursements", report.disbursements);
router.post("/disbursements-download", report.disbursementsDownload);
router.post("/payments", report.payments);
router.post("/payments-download", report.paymentsDownload);
router.get("/date-wise-disb-pay-by-route/:route_id/:date", report.dateWiseDisbPayByRoute);
router.post("/registration-information", report.registrationInformation);
router.post("/credit-information", report.creditInformation);
router.post("/credit-information-by-outlet", report.creditInformationByOutlet);
router.post(
  "/doc-submit-to-fi",
  uploadDocSubmitted.single("file"),
  report.uploadDocSubmittedOutlets
  );
router.post("/get-bad-debts-outlets",report.getBadDebtsOutlets);
router.post("/get-bad-debts-outlets-download",report.getKycFiApprovedDownload);
router.post("/payment_made_by_dh_to_fi",report.paymentMadeByDhToFi);
router.post("/payment_made_by_dh_to_fi_download",report.paymentMadeByDhToFiDownload);
router.post("/total_credit_memo_vs_payments",report.totalCreditMemoVsPayments);
router.post("/total_credit_memo_vs_payments_download",report.totalCreditMemoVsPaymentsDownload);
router.post("/outlet_wise_credit_info",report.outletWiseCreditInfo);
router.post("/outlet_wise_credit_info_download",report.outletWiseCreditInfoDownload);
router.get("/check-block-due/:id_outlet",report.checkIfAnyBlcokDue);
router.post("/repayment_day_report",report.repaymentDayReport);
router.post("/repayment_day_report_download",report.repaymentDayReportDownload);
router.post("/upload-review-old-credit-limit",uploadReviewOldCredit.single("file"), credit.reviewOldCreditLimit);

router.post("/get_dh_billing_info",billing.getDhBillingInfo);
router.post("/submitted_dh_billing_info",billing.submittedDhBillingInfo);
router.post("/download_dh_billing_info",billing.downloadDhBillingInfo);
router.post("/submit_dh_billing_info",billing.submitDhBillingInfo);
router.post("/download_dh_billing_history",billing.downloadDhBillingHistory);

router.get("/support-outlet-list",support.supportOutletList);
router.post("/update-outlet-info",support.updateOutletInfo);
router.post("/delete-outlet-disbursement",support.deleteOutletDisbursement);
router.post("/delete-outlet-payment",support.deleteOutletPayment);

router.get("/check-live-sync-status/:id_point?",disbursement.checkLiveSyncStatus);

module.exports = router;
