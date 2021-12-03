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
const locationId = process.env["SQUARE_LOCATION_ID"];


const {
  customersApi,
  twilioClient,
  locationsApi,
  bookingsApi
} = require("../util/square-client");




router.get("/", async (req, res, next) => {
    const phoneNumber = req.body.phoneNumber;
    let customerId = 0, approved = false;

    try {

        res.render("pages/view-history", {phoneNumber, customerId, approved});

    } catch {

    }
});

router.post("/verifynumber", async (req, res, next) => {
    const phoneNumber = "+1" + req.body.phoneNumber;
    const approved = true;
    let customerId;
    let verificationStatus;
    

    console.log(phoneNumber);

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

        // customer exists
        if (customers && customers.length > 0) {
            matchingCustomers = customers.filter(customer => customer.phoneNumber === phoneNumber);
            if (matchingCustomers.length > 0) {
                customerId = matchingCustomers[0].id;
                twilioClient.verify.services(twilioVerificationSID).verifications.create({to: phoneNumber, channel: 'sms'})
                .then(verification => console.log("message status", verification.status));
//                res.render("pages/contact", { serviceItems, serviceVariation, serviceVersion, startAt, teamMemberBookingProfile, phoneNumber, customerId });
                res.render("pages/view-history", { phoneNumber, customerId, approved});
            }
        } else {
            // customer doesn't exist, bring user to homepage, add a parameter , display banner saying they don't have a history to display
            customerId = 0;
            res.render("pages/view-history", { phoneNumber, customerId, approved});
        }

    } catch {

    }


})

router.post("/verifyauthcode", async (req, res, next) => {
    const authCode = req.body.authCode;
    const customerId = req.body.customerId;
    const phoneNumber = req.body.phoneNumber;
    let verificationStatus;
    let approved;

    console.log(phoneNumber);

    try {

        await twilioClient.verify.services(twilioVerificationSID).verificationChecks.create({to: phoneNumber, code: authCode}).then(verificationCheck => {
            verificationStatus = verificationCheck;
        });
        console.log(verificationStatus);
        if (verificationStatus === 'approved') {
            approved = true;
            //1. retrieve customer using customer id
            const { result: { customer } } = await customersApi.retrieveCustomer(customerId);

            //2. retrieve bookings from last 31 days
            const { result: { teamMemberBookingProfiles } } = await bookingsApi.listTeamMemberBookingProfiles(true, undefined, undefined, locationId);
            // console.log(teamMemberBookingProfiles);
            const teamMember = teamMemberBookingProfiles[0];
            const teamMemberId = teamMember.teamMemberId;
            //3. from the bookings retrieved, filter for those that have customer id
            const response = await bookingsApi.listBookings(undefined,
                undefined,
                undefined,
                'LP8FVR13X0H4Y',
                '2021-08-08T01:00:51.607Z',
                '2021-09-08T01:00:51.607Z');





            res.render("pages/customer-history");
            //res.render view history page
        } else {
            approved = false;
            res.render("pages/view-history", { phoneNumber, customerId, approved });
        }

        



    } catch {

    }
})


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
