import mongoose from 'mongoose';

const errorEventSchema = new mongoose.Schema(
  {
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'issue',
      required: true,
      index: true, // Fast lookup when fetching all events for a specific bug
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'branch',
      required: true,
    },
    route: {
      type: String,
      default: 'N/A',
    },
    httpMethod: {
      type: String,
      default: 'UNKNOWN',
    },
    headers: {
      type: Object,
      default: {},
    },
    userContext: {
      type: Object,
      default: {}, // Optional info like user ID or IP address
    },
  },
  { timestamps: true }
);

const ErrorEvent = mongoose.model('ErrorEvent', errorEventSchema);

export default ErrorEvent;