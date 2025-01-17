'use strict';

const { ObjectId } = require('mongodb');
const Project = require('../db').Project;
const Issue = require('../db').Issue;

const getIssues = async (req, res) => {
  const { query } = req;

  let _id;
  if (query._id) {
    query._id = new ObjectId(query._id);
    _id = query._id;
  }

  if (query.open === '' || query.open === 'true') query.open = true;
  else if (query.open === 'false') query.open = false;

  const matches = [];
  for (const key in query) {
    if (query[key] !== '') {
      matches.push({ $match: { [`issues.${key}`]: query[key] } });
    }
  }

  try {
    const result = await Project.aggregate([
      { $match: { name: req.params.project } },
      { $unwind: '$issues' },
      ...matches,
    ]).exec();

    if (result && result.length > 0) {
      return res.json(result.map((i) => i.issues));
    } else {
      return res.json({ error: 'no issues found', _id });
    }
  } catch (err) {
    return res.json({ error: 'no issues found', _id, err });
  }
};

const postIssue = async (req, res) => {
  const { issue_title, issue_text, created_by, assigned_to, status_text } =
    req.body;

  if (!issue_title || !issue_text || !created_by) {
    return res.json({ error: 'required field(s) missing' });
  }

  const issue = new Issue({
    issue_title: issue_title || '',
    issue_text: issue_text || '',
    created_by: created_by || '',
    created_on: new Date(),
    updated_on: new Date(),
    assigned_to: assigned_to || '',
    status_text: status_text || '',
    open: true,
  });

  try {
    const result = await Project.findOneAndUpdate(
      { name: req.params.project },
      { $push: { issues: issue } },
      { upsert: true, returnDocument: 'after' }
    ).exec();
    if (result && result._id) {
      return res.json(issue);
    } else {
      return res.json({ error: 'could not save' });
    }
  } catch (err) {
    return res.json({ error: 'could not save', err });
  }
};

const putIssue = async (req, res) => {
  const updateData = req.body;
  let _id;
  if (updateData._id) {
    try {
      updateData._id = new ObjectId(updateData._id);
    } catch (err) {
      return res.json({ error: 'could not update', _id });
    }

    _id = updateData._id;
  } else {
    return res.json({ error: 'missing _id' });
  }

  for (const p in updateData) {
    if (updateData[p] === '') {
      delete updateData[p];
    }
  }

  // if updateData has only id, return error
  if (Object.keys(updateData).length === 1) {
    return res.json({ error: 'no update field(s) sent', _id });
  }

  try {
    const $set = { updated_on: new Date() };
    if (updateData.issue_title) {
      $set.issue_title = updateData.issue_title;
    }
    if (updateData.issue_text) {
      $set.issue_text = updateData.issue_text;
    }
    if (updateData.created_by) {
      $set.created_by = updateData.created_by;
    }
    if (updateData.assigned_to) {
      $set.assigned_to = updateData.assigned_to;
    }
    if (updateData.status_text) {
      $set.status_text = updateData.status_text;
    }
    if (updateData.open) {
      $set.open = updateData.open === '' || updateData.open === 'true';
    }

    for (const p in $set) {
      $set[`issues.$.${p}`] = $set[p];
      delete $set[p];
    }

    const result = await Project.findOneAndUpdate(
      { name: req.params.project, 'issues._id': _id },
      { $set },
      { returnDocument: 'after' }
    ).exec();

    if (result && result._id) {
      return res.json({ result: 'successfully updated', _id });
    } else {
      return res.json({ error: 'could not update', _id });
    }
  } catch (err) {
    return res.json({ error: 'could not update', _id, err });
  }
};

const deleteIssue = async (req, res) => {
  let { _id } = req.body;
  if (_id) {
    try {
      _id = new ObjectId(_id);
    } catch (err) {
      return res.json({ error: 'could not delete' });
    }
  } else {
    return res.json({ error: 'missing _id' });
  }

  try {
    const result = await Project.updateOne(
      { name: req.params.project },
      { $pull: { issues: { _id } } },
      { upsert: true, returnDocument: 'after' }
    ).exec();
    if (result && result.modifiedCount > 0) {
      return res.json({ result: 'successfully deleted', _id });
    } else {
      return res.json({ error: 'could not delete', _id });
    }
  } catch (err) {
    return res.json({ error: 'could not delete', _id, err });
  }
};

module.exports = function (app) {
  app
    .route('/api/issues/:project')
    .get(getIssues)
    .post(postIssue)
    .put(putIssue)
    .delete(deleteIssue);
};