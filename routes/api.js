'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const xssFilters = require('xss-filters');

const DB_URI = process.env.DB_URI
const ENDPOINT = '/api/issues/:project';

const connectToDatabase = async () => {
  console.log('Attempting to connect to the database...');
  try {
    const client = new MongoClient(DB_URI);
    await client.connect();
    console.log('Connected successfully to the database');
    return client.db();
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    throw error;
  }
};

const isValidObjectId = (id) => ObjectId.isValid(id) && String(new ObjectId(id)) === id;

module.exports = (app) => {
  app.get(ENDPOINT, async (req, res) => {
    const project = req.params.project;
    const query = req.query;

    if (query._id && isValidObjectId(query._id)) {
      query._id = new ObjectId(query._id);
    }

    try {
      const db = await connectToDatabase();
      const collection = db.collection(project);

      const documents = await collection.find(query).sort({ updated_on: -1 }).toArray();
      res.json(documents);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  });

  app.post(ENDPOINT, async (req, res) => {
    const newIssue = {
      issue_title: req.body.issue_title,
      issue_text: req.body.issue_text,
      assigned_to: req.body.assigned_to || '',
      status_text: req.body.status_text || '',
      created_by: req.body.created_by,
      open: true,
      created_on: new Date(),
      updated_on: new Date(),
    };

    if (!newIssue.issue_title || !newIssue.issue_text || !newIssue.created_by) {
      return res.status(400).send('Missing required fields');
    }

    try {
      const db = await connectToDatabase();
      const collection = db.collection(req.params.project);

      const result = await collection.insertOne(newIssue);
      newIssue._id = result.insertedId;
      res.json(newIssue);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  });

  app.put(ENDPOINT, async (req, res) => {
    const issueID = req.body._id;

    if (!issueID || !isValidObjectId(issueID)) {
      return res.status(400).send('_id error');
    }

    const updates = req.body;
    delete updates._id;

    if (Object.keys(updates).length === 0) {
      return res.status(400).send('no updated field sent');
    }

    updates.updated_on = new Date();

    try {
      const db = await connectToDatabase();
      const collection = db.collection(req.params.project);

      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(issueID) },
        { $set: updates },
        { returnDocument: 'after' }
      );

      if (result.value) {
        res.send('successfully updated');
      } else {
        res.status(404).send('Issue not found');
      }
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  });

  app.delete(ENDPOINT, async (req, res) => {
    const issueID = req.body._id;

    if (!issueID || !isValidObjectId(issueID)) {
      return res.status(400).send('_id error');
    }

    try {
      const db = await connectToDatabase();
      const collection = db.collection(req.params.project);

      const result = await collection.deleteOne({ _id: new ObjectId(issueID) });

      if (result.deletedCount === 1) {
        res.send(`deleted ${issueID}`);
      } else {
        res.status(404).send(`could not delete ${issueID}`);
      }
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  });
};
