/*
Copyright 2021 Square Inc.
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const express = require("express");
const router = express.Router();
require("dotenv").config();
const twilioVerificationSID = process.env["TWILIO_VERIFICATION_SID"];


const {
  customersApi,
  bookingsApi,
  catalogApi,
  twilioClient,
  cardsApi
} = require("../util/square-client");


/**
 * POST /customers/search
 *
 * Retrieve customer ID via search query
 *
 * accepted query param is:
 * req.body.phoneNumbers
 */
router.post("/search", async (req, res, next) => {
    const phoneNumber = "+1" + req.body.phoneNumber;
    const serviceIds = JSON.parse(req.query.serviceIds);
    const staffId = req.query.staffId;
    const startAt = req.query.startAt;

    try {
        const { result: { customers } } = await customersApi.searchCustomers({
            query: {
            filter: {
                phoneNumber: {
                    exact: phoneNumber
                }
            }
            }
        });

        // Send request to get the service associated with the given item variation ID, and related objects.
        const { result } = await catalogApi.batchRetrieveCatalogObjects({
            objectIds: serviceIds
        });

        const serviceItems = result.objects;
        let depositAmount = 0n;
        serviceItems.forEach(service => {
            depositAmount = depositAmount + service.itemVariationData.priceMoney.amount;
        });

        depositAmount = ((Number(depositAmount)/2)) * .01;

        // Send request to get the team member profile of the staff selected
        const { result: { teamMemberBookingProfile } } = await bookingsApi.retrieveTeamMemberBookingProfile(staffId);

        // const serviceItem = relatedObjects.filter(relatedObject => relatedObject.type === "ITEM")[0];

        let matchingCustomers = [];

        let customerId = 0;

        let verified = false;
        
        if (customers && customers.length > 0) {
            matchingCustomers = customers.filter(customer => customer.phoneNumber === phoneNumber);
            if (matchingCustomers.length > 0) {
                customerId = matchingCustomers[0].id;
                twilioClient.verify.services(twilioVerificationSID).verifications.create({to: phoneNumber, channel: 'sms'})
                .then(verification => console.log("message status", verification.status));
//                res.render("pages/contact", { serviceItems, serviceVariation, serviceVersion, startAt, teamMemberBookingProfile, phoneNumber, customerId });
                res.render("pages/contact", { serviceItems, serviceIds, startAt, teamMemberBookingProfile, phoneNumber, customerId, depositAmount });
            }
        } else {
            res.render("pages/customers", { serviceItems, serviceIds, startAt, teamMemberBookingProfile, customerId, phoneNumber, verified, depositAmount  });
        }

     
    } catch (error) {
      console.error(error);
      next(error);
    }
});

/**
 * POST /customers/validate
 *
 * validate user via text message using twilio verify
 *
 *
 */
router.post("/validate", async (req, res, next) => {
    const authCode = req.body.authCode;
    const customerId = req.body.customerId;
    const phoneNumber = req.body.phoneNumber;
    const serviceIds = JSON.parse(req.query.serviceIds);
    const staffId = req.query.staffId;
    const startAt = req.query.startAt;
    let verificationStatus;

    try {

    await twilioClient.verify.services(twilioVerificationSID).verificationChecks.create({to: phoneNumber, code: authCode}).then(verificationCheck => {
            verificationStatus = verificationCheck;
    });

    if (verificationStatus.status === 'approved') {
        const { result: { customer } } = await customersApi.retrieveCustomer(customerId);

        const { result: { cards } } = await cardsApi.listCards('', customerId);

        // Send request to get the service associated with the given item variation ID, and related objects.
        const { result } = await catalogApi.batchRetrieveCatalogObjects({
            objectIds: serviceIds
        });

        const serviceItems = result.objects;
        let depositAmount = 0n;
        serviceItems.forEach(service => {
            depositAmount = depositAmount + service.itemVariationData.priceMoney.amount;
        });

        depositAmount = ((Number(depositAmount)/2)) * .01;


        // Send request to get the team member profile of the staff selected
        const { result: { teamMemberBookingProfile } } = await bookingsApi.retrieveTeamMemberBookingProfile(staffId);

        let card;

        const verified = true;

        if (cards && cards.length > 0) {
            card = {
                id: cards[0].id,
                last4: cards[0].last4,
                cardBrand: cards[0].cardBrand
            }
        }
        console.log("Verification succes. Sending you to the customers page!");
        // const responseBody  = { verified, serviceItem, serviceVariation, serviceVersion, startAt, teamMemberBookingProfile, customerId, phoneNumber, customer, card, verified };
        
        
        //res.send(toObject(responseBody));

        res.render("pages/customers", { serviceItems, serviceIds, startAt, teamMemberBookingProfile, customerId, phoneNumber, customer, card, verified, cards, depositAmount });

    } else {

        // Send request to get the service associated with the given item variation ID, and related objects.
        const { result } = await catalogApi.batchRetrieveCatalogObjects({
            objectIds: serviceIds
        });

        const serviceItems = result.objects;

        // Send request to get the team member profile of the staff selected
        const { result: { teamMemberBookingProfile } } = await bookingsApi.retrieveTeamMemberBookingProfile(staffId);

        const verified = false;
        const responseBody = { verified, serviceItems, serviceIds, startAt, teamMemberBookingProfile, phoneNumber }
        console.log("Verification failed. Retry verification");
        //res.send(toObject(responseBody));
    }


    } catch (error) {
      console.error(error);
      next(error);
    }
});

function toObject(object) {
    return JSON.parse(JSON.stringify(object, (key, value) =>
        typeof value === 'bigint'
            ? value.toString()
            : value // return everything else unchanged
    ));
}

module.exports = router;
