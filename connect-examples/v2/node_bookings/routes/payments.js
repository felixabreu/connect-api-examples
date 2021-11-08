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

const {
  customersApi,
  bookingsApi,
  catalogApi,
  paymentsApi,
  cardsApi,
} = require("../util/square-client");
const { v4: uuidv4 } = require("uuid");

require("dotenv").config();
const locationId = process.env["SQUARE_LOCATION_ID"];

/**
 * POST /payments
 *
 * retrieve payment and book appointment
 *
 * accepted query param is:
 * req.body.phoneNumbers
 */
router.post("/", async (req, res, next) => {
    const firstName = req.body.givenName;
    const lastName = req.body.familyName;
    const phoneNumber = req.body.phoneNumber;
    const emailAddress = req.body.emailAddress;
    const customerNote = req.body.customerNote;
    const cardToken = req.body.cardToken;
    const customerId = req.body.customerId;

    const serviceIds = JSON.parse(req.query.serviceIds);
//    const serviceVariationVersion = req.query.version;
    const staffId = req.query.staffId;
    const startAt = req.query.startAt;

    try {
    
    // retrieve service info
    const { result } = await catalogApi.batchRetrieveCatalogObjects({
        objectIds: serviceIds
    });

    const serviceItems = result.objects;

    let durationMinutes = 0n;
    let depositAmount = 0n;
    let appointmentSegments = [];

    serviceItems.forEach(service => {
        const appointmentSegment = {};
        Object.defineProperty(appointmentSegment, 'durationMinutes', {
            get() {
                return convertMsToMins(service.itemVariationData.serviceDuration);
            }
        });
        Object.defineProperty(appointmentSegment, 'serviceVariationId', {
            get() {
                return service.id;
            }
        });
        Object.defineProperty(appointmentSegment, 'serviceVariationVersion', {
            get() {
                return Number(service.version);
            }
        });
        Object.defineProperty(appointmentSegment, 'teamMemberId', {
            get() {
                return staffId;
            }
        });


        durationMinutes = durationMinutes + service.itemVariationData.serviceDuration;
        depositAmount = depositAmount + service.itemVariationData.priceMoney.amount;
        appointmentSegments.push(appointmentSegment);
    })
    
    durationMinutes = convertMsToMins(durationMinutes);
    depositAmount = Math.round(Number(depositAmount/2n));
    console.log(depositAmount);

    //const durationMinutes = convertMsToMins(serviceInfo.body.itemData.serviceDuration);
    if (!customerId) {
        // create customer
        const { result: { customer } } = await customersApi.createCustomer({
            givenName: firstName,
            familyName: lastName,
            emailAddress: emailAddress,
            phoneNumber: phoneNumber,
            referenceId: 'SPWAX_WEBAPP',
            idempotencyKey: uuidv4(),
            note: customerNote
        });

        // store card
        const { result: { card: storeCardConfirmation } } = await cardsApi.createCard({
            idempotencyKey: uuidv4(),
            sourceId: cardToken,
            card: {
                customerId: customer.id
            }
        });

        // create payment using stored card
        const { result: { payment } } = await paymentsApi.createPayment({
            sourceId: storeCardConfirmation.id,
            idempotencyKey: uuidv4(),
            amountMoney: {
                amount: depositAmount,
                currency: 'USD'
            },
            customerId: customer.id
        });

        // Create booking
        const { result: { booking } } = await bookingsApi.createBooking({
        booking: {
            customerId: customer.id,
            appointmentSegments: appointmentSegments,
            customerNote,
            locationId,
            startAt,
        },
        idempotencyKey: uuidv4(),
        });

            // const [ { result: { customerInfoConfirmed } }, { result: { storeCardInfoConfirmed } }, { result: { paymentInfoConfirmed } }, { result: { bookingInfoConfirmed } } ] =
    //   await Promise.all([ customer, storeCardConfirmation, payment, booking ]);
        // res.redirect("/booking/" + booking.id);
        res.send({bookingId: booking.id});

    } else {

        // create payment using stored card
        const { result: { payment } } = await paymentsApi.createPayment({
            sourceId: cardToken,
            idempotencyKey: uuidv4(),
            amountMoney: {
                amount: depositAmount,
                currency: 'USD'
            },
            customerId: customerId
        });

        // Create booking
        const { result: { booking } } = await bookingsApi.createBooking({
        booking: {
            appointmentSegments: appointmentSegments,
            customerId: customerId,
            customerNote,
            locationId,
            startAt,
        },
        idempotencyKey: uuidv4(),
        });

        res.send({bookingId: booking.id});
        
    }

    
    // // Wait until all API calls have completed
    // const [ { result: { customerInfoConfirmed } }, { result: { storeCardInfoConfirmed } }, { result: { paymentInfoConfirmed } }, { result: { bookingInfoConfirmed } } ] =
    //   await Promise.all([ customer, storeCardConfirmation, payment, booking ]);

    } catch (error) {
      console.error(error);
      next(error);
    }
});

/**
 * Convert a duration in milliseconds to minutes
 *
 * @param {*} duration - duration in milliseconds
 * @returns {Number} - duration in minutes
 */
function convertMsToMins(duration) {
    return Math.round(Number(duration) / 1000 / 60);
  }

module.exports = router;
