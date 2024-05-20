import mongoose, { Schema } from "mongoose";

const OrderSchema = mongoose.Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Products",
      required: true,
    },
    thumbnail: {
      type: String,
      required: [true, "please upload display Images of Product"],
      immutable: true,
    },
    quantity: {
      type: Number,
      required: false,
      min: 1,
      default: 1,
    },
    size: {
      type: String,
      required: false,
      default: "N/A",
    },
    color: {
      type: String,
      required: false,
      default: "N/A",
    },
    ordered_by: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    sold_by: {
      type: Schema.Types.ObjectId,
      ref: "Sellers",
      required: true,
    },
    rating: {
      type: Schema.Types.ObjectId,
      ref: "Ratings",
      required: false,
      default: null,
    },
    mrp_total: {
      type: Number,
      required: [true, "mrp_total is required"],
    },
    tax_total: {
      type: Number,
      required: false,
      default: 0,
    },
    delivery_charge_total: {
      type: Number,
      required: false,
      default: 0,
    },
    sub_total: {
      type: Number,
      required: false,
    },
    discount_total: {
      type: Number,
      required: [true, "discount_total is required"],
      default: 0,
    },
    total: {
      type: Number,
      required: [true, "grand_total is required"],
    },
    payment_mode: {
      type: String,
      required: [false, "must include mode of payment method"],
      immutable: false,
      enum: {
        values: ["cod", "prepaid"],
        message: `{VALUE} Payment Method is not supported`,
      },
    },
    order_completed: {
      type: Boolean,
      required: [
        false,
        "it indicates that weather the order is completed or not",
      ],
      default: false,
    },
    delivery_status: {
      type: String,
      required: [
        false,
        "it indicates that how much process is completed of our order",
      ],
      enum: {
        values: [
          "none",
          "order_pending",
          "order_cancel",
          "order_accepted",
          "order_shiped",
          "out_for_delivery",
          "delivered",
        ],
        message: `{VALUE} is not supported in order status`,
      },
      default: "none",
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", OrderSchema);
export default Order;
