import mongoose from "mongoose";

const OrderSummarySchema = mongoose.Schema({
    orders: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Orders',
        required: true
    },
    grand_mrp: {
        type: Number,
        required: [true, 'mrp_total is required']
    },
    grand_tax: {
        type: Number,
        required: false,
        default: 0
    },
    grand_delivery_charge: {
        type: Number,
        required: false,
        default: 0
    },
    grand_subtotal: {
        type: Number,
        required: false,
        default: function () {
            return this.mrp_total + this.tax_total + this.delivery_charge_total
        },
        validate: {
            validator: function (value) {
                const total = this.mrp_total + this.tax_total + this.delivery_charge_total
                if (value == total) return true
            }
        }
    },
    grand_discount: {
        type: Number,
        required: [true, 'discount_total is required'],
        default: 0
    },
    grand_total: {
        type: Number,
        required: [true, 'net_total is required'],
        default: function () {
            return this.sub_total - this.discount_total
        },
        validate: {
            validator: function (value) {
                const total = this.sub_total - this.discount_total
                if (value == total) return true
            }
        }
    },
})

const OrderSummary = mongoose.model("Ordersummary", OrderSummarySchema)

export default OrderSummary