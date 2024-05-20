import mongoose, { Schema } from "mongoose";

const ProductSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "must include name of product"],
      validate: {
        validator: function (name) {
          if (name.trim() !== "") return true;
        },
      },
    },
    product_code: {
      type: String,
      required: [
        true,
        "Product code is reqired for identify same product with diffrent color and size",
      ],
      immutable: true,
    },
    brand: {
      type: String,
      required: [true, "must include name of product's brand"],
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "Sellers",
      required: [true, "owner should be specified at serverside"],
      immutable: true,
    },
    mrp: {
      type: Number,
      min: 1,
      validate: {
        validator: function () {
          if (this.mrp >= 1) return true;
        },
        message: "mrp should be a positive number",
      },
      required: [true, "Please Enter Valid MRP "],
      immutable: false,
    },
    discount: {
      type: Number,
      required: false,
      immutable: false,
      default: 0,
      min: 0,
      max: 99,
    },
    sell_price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    long_description: {
      type: [String],
      required: [true, "Specific details about This product is required"],
      immutable: false,
    },
    short_description: {
      type: String,
      required: [true, "Specific details about This product is required"],
      immutable: false,
    },
    thumbnail: {
      type: String,
      required: [true, "please upload display Images of Product"],
      immutable: true,
    },
    images: {
      type: [String],
      required: [true, "please upload some Images of Product"],
      immutable: true,
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
    available_size: {
      type: [String],
      required: false,
      default: ["N/A"],
    },
    available_color: {
      type: [String],
      required: false,
      default: ["N/A"],
    },
    category: {
      type: String,
      required: [true, "please select specific category of product"],
      immutable: true,
      enum: {
        values: [
          `women_tops`,
          `women_kurtas`,
          `women_bottoms`,
          `women_foowear`,
          `women_makeup`,
          `women_purse`,
          `women_jwellary`,
          `women_skin_hair_cares`,
          `men_shirt_tshirt`,
          `men_jeans`,
          `men_formals`,
          `men_kurtas`,
          `men_foowear`,
          `men_skin_hair_cares`,
          `men_accesory`,
          `kids_shirt_tshirt`,
          `kids_bottoms`,
          `kids_foowear`,
          `kids_accesory`,
          `kids_toys`,
          `gadgets`,
          `tvs`,
          `ac_cooler_fans`,
          `mobile`,
          `tablet`,
          `laptop`,
          `cpus`,
          `monitor`,
          `electronics_accesory`,
          `grossary`,
          `spices`,
          `snacks`,
          `icecream`,
          `chocolates`,
          `kitchen`,
          `furniture`,
          `freash_clean`,
          `tools`,
        ],
        message: `this category is not supported in Product Category`,
      },
    },
    tags: {
      type: [String],
      required: [
        true,
        "please put some tags , that can make product easily found",
      ],
    },
    ratings: {
      type: [Schema.Types.ObjectId],
      ref: "Ratings",
      required: false,
    },
    tax: {
      type: Number,
      validate: {
        validator: function () {
          if (this.tax >= 0 && this.tax <= 99) return true;
        },
        message: "Please Give Valid tax in Between 0 to 99 Percente",
      },
      required: false,
      immutable: false,
      default: 0,
    },
    delivery_charge: {
      type: Number,
      required: false,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Products = mongoose.model("Products", ProductSchema);
export default Products;
