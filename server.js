const express = require("express");
const admin = require("firebase-admin");
const fs = require("fs"); // Import fs
const cors = require("cors"); // Import CORS
const app = express(); // Initialize Express
require("dotenv").config();

const port = process.env.PORT;
const google_api = process.env.GOOGLE_API_KEY;

// Decode the base64 FIREBASE_ADMIN_SDK_KEY
const firebaseKeyBase64 = process.env.FIREBASE_ADMIN_SDK_KEY;
const firebaseKeyJson = JSON.parse(
  Buffer.from(firebaseKeyBase64, "base64").toString("utf8")
);

const { ParkingSpot, Street } = require("./dataClasses");

app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Middleware to parse JSON

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(firebaseKeyJson),
});

const db = admin.firestore(); // Initialize Firestore

app.get("/", (req, res) => {
  return res.status(200).json({
    msg: "Parking-backend",
  });
});

// POST request to upload parking spots from JSON file to Firestore
app.post("/uploadParkingspots", async (req, res) => {
  try {
    const data = fs.readFileSync("parkingSpots.json", "utf8");
    const parkingData = JSON.parse(data);
    const batch = db.batch();

    parkingData.Street.forEach((streetData) => {
      const streetName = streetData.name; // Get street name
      console.log(streetName);

      // Upload southern parking spots
      if (streetData.southernParkingspots) {
        streetData.southernParkingspots.forEach((spotData) => {
          const collectionRef = db
            .collection(streetName)
            .doc("southern")
            .collection("parkingspots");
          const docRef = collectionRef.doc(); // Generate a unique document for each spot
          batch.set(docRef, spotData);
        });
      }

      // Upload northern parking spots
      if (streetData.northernParkingspots) {
        streetData.northernParkingspots.forEach((spotData) => {
          const collectionRef = db
            .collection(streetName)
            .doc("northern")
            .collection("parkingspots");
          const docRef = collectionRef.doc();
          batch.set(docRef, spotData);
        });
      }

      // Upload eastern parking spots
      if (streetData.easternParkingspots) {
        streetData.easternParkingspots.forEach((spotData) => {
          const collectionRef = db
            .collection(streetName)
            .doc("eastern")
            .collection("parkingspots");
          const docRef = collectionRef.doc(); // Generate a unique document for each spot
          batch.set(docRef, spotData);
        });
      }

      // Upload western parking spots
      if (streetData.westernParkingspots) {
        streetData.westernParkingspots.forEach((spotData) => {
          const collectionRef = db
            .collection(streetName)
            .doc("western")
            .collection("parkingspots");
          const docRef = collectionRef.doc(); // Generate a unique document for each spot
          batch.set(docRef, spotData);
        });
      }
    });

    await batch.commit(); // Commit batch write
    res.status(200).send("Parking spots uploaded successfully.");
  } catch (error) {
    console.error("Error uploading parking spots:", error);
    res.status(500).send("Error uploading parking spots.");
  }
});

app.get("/getParkingspots", async (req, res) => {
  try {
    const collections = await db.listCollections();
    let parkingSpots = {};

    for (const collectionRef of collections) {
      const streetName = collectionRef.id; // Street name as collection ID
      let streetData = {
        southernParkingspots: [],
        northernParkingspots: [],
        easternParkingspots: [],
        westernParkingspots: [],
      };

      // Fetch southern parking spots
      const southernDocRef = db.collection(streetName).doc("southern");
      const southernSnapshot = await southernDocRef
        .collection("parkingspots")
        .get();

      if (!southernSnapshot.empty) {
        southernSnapshot.docs.forEach((doc) => {
          const spotData = doc.data();
          streetData.southernParkingspots.push({
            spotID: spotData.spotID,
            latitude: spotData.latitude,
            longitude: spotData.longitude,
            occupied: spotData.occupied,
          });
        });
      }

      // Fetch northern parking spots
      const northernDocRef = db.collection(streetName).doc("northern");
      const northernSnapshot = await northernDocRef
        .collection("parkingspots")
        .get();

      if (!northernSnapshot.empty) {
        northernSnapshot.docs.forEach((doc) => {
          const spotData = doc.data();
          streetData.northernParkingspots.push({
            spotID: spotData.spotID,
            latitude: spotData.latitude,
            longitude: spotData.longitude,
            occupied: spotData.occupied,
          });
        });
      }

      // Fetch eastern parking spots
      const easternDocRef = db.collection(streetName).doc("eastern");
      const easternSnapshot = await easternDocRef
        .collection("parkingspots")
        .get();

      if (!easternSnapshot.empty) {
        easternSnapshot.docs.forEach((doc) => {
          const spotData = doc.data();
          streetData.easternParkingspots.push({
            spotID: spotData.spotID,
            latitude: spotData.latitude,
            longitude: spotData.longitude,
            occupied: spotData.occupied,
          });
        });
      }

      // Fetch western parking spots
      const westernDocRef = db.collection(streetName).doc("western");
      const westernSnapshot = await westernDocRef
        .collection("parkingspots")
        .get();

      if (!westernSnapshot.empty) {
        westernSnapshot.docs.forEach((doc) => {
          const spotData = doc.data();
          streetData.westernParkingspots.push({
            spotID: spotData.spotID,
            latitude: spotData.latitude,
            longitude: spotData.longitude,
            occupied: spotData.occupied,
          });
        });
      }

      parkingSpots[streetName] = streetData; // Store data per street
    }

    console.log(parkingSpots);
    res.json(parkingSpots);
  } catch (error) {
    console.error("Error fetching parking spots:", error);
    res.status(500).json({ error: "Failed to retrieve parking spots" });
  }
});

app.post("/updateMultipleParkingSpots", async (req, res) => {
  console.log("UpdateMultipleParkingSpots");
  const { oldLat, oldLng, newLat, newLng, registeredCars, street } = req.body;
  var candidateCars = [];

  // Validate required fields
  if (!oldLat || !oldLng || !newLat || !newLng || !street || !registeredCars) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // **Call Map Matching API to get corrected coordinates**
    const result = await mapMatchingAPI(
      oldLat,
      oldLng,
      newLat,
      newLng,
      registeredCars
    );

    if (!result) {
      return res.status(500).json({ error: "Map Matching failed" });
    }

    const { snappedDirection, snappedCars } = result;

    //console.log("Snapped Main Path:", snappedDirection);
    //console.log("Snapped Cars:", snappedCars);

    // **Use corrected coordinates for parking spot lookup**
    const { candidateSpots, direction } = await findCandidateSpots(
      snappedDirection.oldLat,
      snappedDirection.oldLng,
      snappedDirection.newLat,
      snappedDirection.newLng,
      street.toLowerCase()
    );

    // Convert to ParkingSpot objects
    candidateCars = candidateSpots.map(
      (spot) =>
        new ParkingSpot(
          spot.spotID,
          spot.latitude,
          spot.longitude,
          spot.occupied
        )
    );

    console.log(
      "Candidate parking spots found:",
      candidateCars.map((spot) => spot.spotID)
    );

    if (candidateCars.length > 0) {
      const parkedCars = await compareCandidates(candidateCars, snappedCars);
      // Pass direction to update the correct Firestore subcollection
      await updateParkingStatusOfSpots(
        candidateCars,
        street,
        parkedCars,
        direction
      );
    }

    // Process data
    res.json({
      message: "Updates multiple spots",
      msg: "UpdateMultipleParkingspots",
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

async function updateParkingStatusOfSpots(
  candidatespots,
  street,
  registeredCars,
  direction
) {
  try {
    console.log("Updating parking status...");
    //console.log("Candidates:", candidatespots);
    //console.log("Registered:", registeredCars);
    console.log("Direction:", direction);

    if (candidatespots.length > 0) {
      await updateSpotsInFirestore(candidatespots, false, street, direction);
      console.log("Antal candidateSpots: " + candidatespots.length);
    }

    if (registeredCars.length > 0) {
      await updateSpotsInFirestore(registeredCars, true, street, direction);
      console.log("Antal registrerede biler: " + registeredCars.length);
    }

    return { message: "Parking status updated successfully" };
  } catch (error) {
    console.error("Error updating parking spots:", error);
    throw new Error("Failed to update parking spots");
  }
}

async function updateSpotsInFirestore(spots, isOccupied, street, direction) {
  console.log("Updating Firestore for direction:", direction);

  for (const spot of spots) {
    //console.log("Processing spot:", spot.spotID);

    const existingParkingspotRef = db
      .collection(street.toLowerCase())
      .doc(direction)
      .collection("parkingspots")
      .where("spotID", "==", parseInt(spot.spotID));

    const existingParkSnapshot = await existingParkingspotRef.get();

    if (existingParkSnapshot.empty) {
      console.error(
        `Parking spot ${spot.spotID} not found in ${street}/${direction}`
      );
      continue;
    }

    const parkingDoc = existingParkSnapshot.docs[0];
    const parkingSpotRef = parkingDoc.ref;

    await parkingSpotRef.update({ occupied: isOccupied });

    console.log(
      `Updated parking spot ${spot.spotID} occupancy to ${isOccupied} in ${direction}`
    );
  }
}

async function compareCandidates(allCandidates, registeredCars) {
  console.log("compareCandiates Method:");
  console.log("registered cars:");

  console.log(registeredCars);
  var candidates = [];

  registeredCars.forEach((car) => {
    var registeredCarTarget = calculateTarget(
      car.oldLat,
      car.oldLng,
      car.newLat,
      car.newLng
    );

    // console.log("registeredCarTarget");
    // console.log(registeredCarTarget.targetLat, registeredCarTarget.targetLng);

    let currentClosetestDistance = 10000.0;
    let currentCandidate;
    allCandidates.forEach((candidate) => {
      // console.log(candidate);

      var currentDistance = getDistanceFromLatLonInKm(
        registeredCarTarget.targetLat,
        registeredCarTarget.targetLng,
        candidate.latitude,
        candidate.longitude
      );

      //console.log(candidate);
      if (currentDistance < currentClosetestDistance) {
        currentClosetestDistance = currentDistance;
        currentCandidate = candidate;
        //console.log("log" + candidate);
      }
    });
    candidates.push(currentCandidate);
  });
  return candidates;
}

async function findCandidateSpots(oldLat, oldLng, newLat, newLng, street) {
  const candidateSpots = [];

  // Calculate driven distance
  const drivenDistance = getDistanceFromLatLonInKm(
    oldLat,
    oldLng,
    newLat,
    newLng
  );

  // Determine movement direction
  const latDiff = Math.abs(newLat - oldLat); // 1 for positive, -1 for negative
  const lngDiff = Math.abs(newLng - oldLng);

  //Get the overall car direction to decide which collection to query.
  let direction;
  if (latDiff > lngDiff) {
    direction = newLat > oldLat ? "northern" : "southern";
  } else {
    direction = newLng > oldLng ? "eastern" : "western";
  }
  console.log(`Detected movement direction: ${direction} at ${street} `);

  // Fetch parking spots from Firestore
  const parkingSpotsRef = db
    .collection(street.toLowerCase())
    .doc(direction)
    .collection("parkingspots");
  const parkingSpotsSnapshot = await parkingSpotsRef.get();

  if (parkingSpotsSnapshot.empty) {
    return res.status(404).json({ error: "Parking spot not found." });
  }

  // Check each parking spot
  parkingSpotsSnapshot.forEach((spot) => {
    const spotData = spot.data();
    const distanceToSpot = getDistanceFromLatLonInKm(
      oldLat,
      oldLng,
      spotData.latitude,
      spotData.longitude
    );

    if (distanceToSpot <= drivenDistance) {
      candidateSpots.push(
        new ParkingSpot(
          spotData.spotID,
          spotData.latitude,
          spotData.longitude,
          spotData.occupied
        )
      );
    }
  });

  return { drivenDistance, candidateSpots, direction };
}

// Helper function to check if the spot is in the driven direction
function isSpotInDrivenDirection(
  spot,
  oldLat,
  oldLng,
  latDirection,
  lngDirection
) {
  return (
    Math.sign(spot.latitude - oldLat) === latDirection &&
    Math.sign(spot.longitude - oldLng) === lngDirection
  );
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1); // deg2rad below
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

//Method to calculate target to be flipped
function calculateTarget(oldLat, oldLng, newLat, newLng, street) {
  const metersToDegreesLat = 1 / 111320;
  const metersToDegreesLng = 1 / (111320 * Math.cos((newLat * Math.PI) / 180));

  const offsetX = -2 * metersToDegreesLng; // 2m to the right
  const offsetY = 2 * metersToDegreesLat; // 2m forward

  // 1. Calculate target coordinates
  // Movement direction
  const deltaLng = newLng - oldLng;
  const deltaLat = newLat - oldLat;
  const movementAngle = Math.atan2(deltaLat, deltaLng);

  // Perpendicular angle
  const perpendicularAngle = movementAngle + Math.PI / 2;
  const offsetPointX = newLng + Math.cos(perpendicularAngle) * offsetX;
  const offsetPointY = newLat + Math.sin(perpendicularAngle) * offsetY;

  // Forward calculations by offset
  const targetLng = offsetPointX + Math.cos(movementAngle) * offsetX;
  const targetLat = offsetPointY + Math.sin(movementAngle) * offsetY;
  console.log("Calculatetarget return: " + targetLng, targetLat);
  return { targetLat, targetLng };
}

//2. Compare target to closets existing spots

//3. Flip exissting spot
async function mapMatchingAPI(oldLat, oldLng, newLat, newLng, registeredCars) {
  const baseUrl = "https://roads.googleapis.com/v1/snapToRoads";

  // Construct the API path
  let path = `${oldLat},${oldLng}|${newLat},${newLng}`;
  for (const car of registeredCars) {
    path += `|${car.oldLat},${car.oldLng}|${car.newLat},${car.newLng}`;
  }

  const url = `${baseUrl}?path=${encodeURIComponent(path)}&key=${google_api}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();

    if (!data.snappedPoints || data.snappedPoints.length < 2) {
      throw new Error("Invalid snappedPoints data received.");
    }

    // Extract the first two points for the main movement
    const snappedDirection = {
      oldLat: data.snappedPoints[0].location.latitude,
      oldLng: data.snappedPoints[0].location.longitude,
      newLat: data.snappedPoints[1].location.latitude,
      newLng: data.snappedPoints[1].location.longitude,
    };

    // Skip the first two points and process the remaining snapped points into registered cars
    const snappedCars = [];
    for (let i = 2; i < data.snappedPoints.length; i += 2) {
      if (i + 1 < data.snappedPoints.length) {
        snappedCars.push({
          oldLat: data.snappedPoints[i].location.latitude,
          oldLng: data.snappedPoints[i].location.longitude,
          newLat: data.snappedPoints[i + 1].location.latitude,
          newLng: data.snappedPoints[i + 1].location.longitude,
        });
      }
    }

    return { snappedDirection, snappedCars };
  } catch (error) {
    console.error("Error fetching map matching data:", error);
    return null;
  }
}

// Example usage:
const oldLat = 56.172196;
const oldLng = 10.187958;
const newLat = 56.173651;
const newLng = 10.18858;
const registeredCars = [
  {
    oldLat: 56.172879,
    oldLng: 10.188256,
    newLat: 56.172901,
    newLng: 10.188266,
  },
  { oldLat: 56.173011, oldLng: 10.188295, newLat: 56.17303, newLng: 10.188311 },
];

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
