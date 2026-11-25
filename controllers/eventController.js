const mongoose = require("mongoose");
const Event = require("../models/eventModel.js");
const User = require("../models/userModel.js");
const Website = require("../models/websiteModel.js");
const { handleSuccessResponse, handleErrorResponse, throwError } = require("../utils/utils.js");

// create new event
const createEvent = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.user.id;
        const { eventName, description, location, date, time, expectedNumberOfPeople, phone, email } = req.body;

        // create the event
        const event = await Event.create([{
            organizer: userId,
            eventName,
            description,
            location,
            date,
            time,
            expectedNumberOfPeople,
            phone,
            email
        }], { session });

        // Update the user's event list
        await User.findByIdAndUpdate(userId, { $push: { events: event[0]._id } }, { session });

        // Commit the transaction if both operations succeed
        await session.commitTransaction();

        handleSuccessResponse(res, 201, "Successfully created event", event[0])
    } catch (error) {
        // if any one db operation fails
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        handleErrorResponse(res, error)
    } finally {
        session.endSession();
    }
};

// get all events of single user
const getUserEvents = async (req, res) => {
    const userId = req.user.id;

    try {
        const events = await Event.find({ organizer: userId })
            .sort({ createdAt: -1 })
            .lean(); // newest first

        handleSuccessResponse(res, 200, "Successfully fetched events", events)
    } catch (error) {
        handleErrorResponse(res, error)
    }
};

// get single event
const getSingleEvent = async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user.id;

    try {
        const event = await Event.findById(eventId).lean();

        if (!event) {
            throwError(404, "Event not found")
        }

        // Ownership check
        if (event.organizer.toString() !== userId) {
            throwError(403, "Unauthorized to view this event")
        }

        handleSuccessResponse(res, 200, "Successfully fetched event", event)
    } catch (error) {
        handleErrorResponse(res, error)
    }
};

// edit specific event
const updateEvent = async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    try {
        // const event = await Event.findById(eventId).select("organizer").lean();

        // if (!event) {
        //     throwError(404, "Event not found")
        // }

        // // Ownership check
        // if (event.organizer.toString() !== userId) {
        //     throwError(403, "Unauthorized to edit this event")
        // }

        // const updatedEvent = await Event.findByIdAndUpdate(eventId, updates, {
        //     new: true,
        //     runValidators: true,
        // }).lean();

        const updatedEvent = await Event.findOneAndUpdate(
            { _id: eventId, organizer: userId },
            { $set: updates },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedEvent) {
            throwError(404, "Event not found or unauthorized");
        }

        handleSuccessResponse(res, 200, "Successfully updated event", updatedEvent)
    } catch (error) {
        handleErrorResponse(res, error)
    }
};

// delete specific event
const deleteEvent = async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user.id;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const event = await Event.findById(eventId).select("organizer").session(session).lean();
        if (!event) {
            throwError(404, "Event not found")
        }

        if (event.organizer.toString() !== userId) {
            throwError(403, "Unauthorized to delete this event")
        }

        // delete linked website if ever created
        // await Website.findOneAndDelete({ belongsToThisEvent: eventId }).session(session);
        await Website.deleteOne({ belongsToThisEvent: eventId }).session(session); // Use deleteOne / updateOne when you don't need the deleted/updated doc returned

        // Delete the event
        // await Event.findByIdAndDelete(eventId).session(session);
        await Event.deleteOne({ _id: eventId }).session(session);

        // Remove the event from the User's events list as well
        // await User.findByIdAndUpdate(userId, { $pull: { events: eventId } }).session(session);
        await User.updateOne(
            { _id: userId },
            { $pull: { events: eventId } }
        ).session(session);

        await session.commitTransaction();

        handleSuccessResponse(res, 200, "Successfully deleted event and linked website")
    } catch (error) {
        // if any one db operation fails, abort the whole operation
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        handleErrorResponse(res, error)
    } finally {
        session.endSession();
    }
};

module.exports = {
    createEvent,
    getUserEvents,
    getSingleEvent,
    updateEvent,
    deleteEvent
}
