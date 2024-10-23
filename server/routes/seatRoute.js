const express = require("express");
const router = express.Router();
const SeatList = require("../models/SeatList");

// Helper function to generate continuous sequences of available IDs
const generateContinuousSequences = (idNumbers, totalCards) => {
  const sortedIds = [...new Set(idNumbers)].sort((a, b) => a - b);
  const sequences = [];
  
  let currentSequence = [];
  let lastId = -1;

  // Generate sequences based on available IDs
  for (const id of sortedIds) {
    if (id === lastId + 1) {
      currentSequence.push(id);
    } else {
      if (currentSequence.length > 0) {
        sequences.push(currentSequence);
      }
      currentSequence = [id]; // Start a new sequence
    }
    lastId = id;
  }

  if (currentSequence.length > 0) {
    sequences.push(currentSequence);
  }

  const resultRanges = [];
  let lastEnd = -1; // Track the end of the last range added

  // Collect up to five distinct ranges of the specified length
  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - totalCards; i++) {
      const rangeStart = seq[i];
      const rangeEnd = seq[i + totalCards - 1];

      // Ensure ranges don't overlap and start after the previous range
      if (lastEnd === -1 || rangeStart > lastEnd) {
        resultRanges.push(seq.slice(i, i + totalCards));
        lastEnd = rangeEnd; // Update lastEnd to the current range's end
      }

      if (resultRanges.length === 5) break; // Limit to 5 distinct ranges
    }
    if (resultRanges.length === 5) break; // Stop if we've collected 5 ranges
  }

  // Prepare the range messages
  const rangeMessages = resultRanges.map(range => `Available ID Card No.- ${range[0]} to ${range[range.length - 1]}`);
  return rangeMessages;
};


router.post("/get-cards", async (req, res) => {
  const { location, totalCards } = req.body;

  if (!location || !location.city || totalCards <= 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid city and number of cards",
    });
  }

  const city = location.city.toLowerCase();

  try {
    const sampleData = await SeatList.find().exec();

    if (sampleData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No data found for the provided locations",
      });
    }

    const bookedIds = new Set();
    const availableIdsMap = new Map();

    // Collect available id_nos and booked ids
    for (const locationData of sampleData) {
      const details = locationData.details || [];
      details.forEach(detail => {
        const idNo = parseInt(detail.id_no, 10);
        if (detail.booked === "true") {
          bookedIds.add(idNo);
        } else if (detail.booked === "") {
          availableIdsMap.set(idNo, (availableIdsMap.get(idNo) || 0) + 1);
        }
      });
    }

    const uniqueAvailableIds = [...availableIdsMap.keys()].filter(idNo => !bookedIds.has(idNo));

    const continuousRanges = generateContinuousSequences(uniqueAvailableIds, totalCards);

    if (continuousRanges.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No continuous sequences of available IDs found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        city: city,
        details: {
          available_ranges: continuousRanges,
        },
      },
      message: "Data fetched successfully",
    });

  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

router.post("/book-cards", async (req, res) => {
  const { ranges } = req.body;

  try {
    const updatePromises = ranges.map(async ({ startId, endId, booked }) => {
      return await SeatList.updateMany(
        { 'details.id_no': { $gte: startId, $lte: endId } },
        { $set: { 'details.$[elem].booked': booked } },
        { arrayFilters: [{ 'elem.id_no': { $gte: startId, $lte: endId } }] }
      );
    });

    const results = await Promise.all(updatePromises);
    const totalModified = results.reduce((acc, result) => acc + result.nModified, 0);

    if (totalModified === 0) {
      return res.status(404).json({
        success: false,
        message: "No IDs found or already booked",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
    });
  } catch (error) {
    console.error("Error updating booking status:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
