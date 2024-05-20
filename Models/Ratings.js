import mongoose, { Schema } from "mongoose"

const RatingsSchema = mongoose.Schema({ 
    product: {
        type: Schema.Types.ObjectId,
        ref: 'Products'
    },
    given_by: {
        type: Schema.Types.ObjectId,
        ref: 'Users'
    },
    given_by_name: {
        type: String,
        required: true,
        immutable: false,
        validate: {
            validator: function () {
                if (this.given_by_name.trim() != " ") return true
            }
        }
    },
    value: {
        type: Number,
        required: true,
        validate: {
            validator: function () {
                if (this.value >= 1 && this.value <= 5) return true
            }
        }
    },
    review: {
        type: String,
        required: false,
        immutable: false,
        validate: {
            validator: function () {
                if (this.review.trim() != " ") return true
            }
        }
    },
})

const Ratings = mongoose.model('Ratings', RatingsSchema)
export default Ratings