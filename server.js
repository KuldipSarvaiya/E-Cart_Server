import express from "express";
import SellerDashboard from "./routes/SellerDashboard.js";
import cors from "cors";
import dotenv from "dotenv";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import UserLogin from "./routes/UserLogin.js";
import Cart from "./routes/Cart.js";
import Products from "./Models/Products.js";
import Users from "./Models/Users.js";
import Order from "./Models/Orders.js";
import getS3Url from "./getS3Url.js";
import Sellers from "./Models/Sellers.js";
import Ratings from "./Models/Ratings.js";

const PORT = 8080;
const App = new express();

dotenv.config();

// starting server
App.listen(PORT, () => {
  console.log("server has Started on port 8080");
});

// MongoDB Connection
const Connection = await mongoose
  .connect(process.env.MONGODB_URL, {
    bufferCommands: false,
    dbName: "e-cart",
  })
  .then(() => {
    console.log("Connection with MongoDB_Atlas Established Successfuly");
  })
  .catch((err) => {
    console.log("Error In MongoDb Connection : \n", err.message);
  });

// configuring s3 bukket
const S3 = new S3Client({
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
  region: process.env.BUCKET_REGION,
});

// /=========//=========//========//=========/ globle middlewares /=========//======//=======//=======/
App.use(
  cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
); //Cross Origin Resource Sharing
App.use(express.json()); //to accept the json formate request data
App.use(express.urlencoded({ extended: false })); //to get form data

App.use("/seller_dashboard", SellerDashboard);
App.use("/user_login", UserLogin);
App.use("/cart", Cart);

App.use(function userVerificationFunction(req, res, next) {
  console.log("URL Where Client Has Sent Request = ", req.url);
  console.log(
    "Comon Prefix URL From Where Requests Has Received = ",
    req.baseUrl
  );
  console.log("URI From Where Request Has Received = ", req.originalUrl);
  if (req.headers.authorization.split(" ")[0] === "E-Cart") {
    if (
      req.headers.authorization.split(" ")[1] === "this_is_JWT_loaded_by_axios"
    ) {
      req.auth = { role: "Geust" };
      next();
    } else {
      jwt.verify(
        req.headers.authorization.split(" ")[1],
        process.env.JWT_SECRET_KEY,
        (err, data) => {
          if (err) {
            console.log(
              "error in verification",
              req.headers.authorization.split(" ")[1]
            );
            res.json({ error: true, message: err.message });
          } else {
            // if (data.role === "seller")
            //   res.json({
            //     error: true,
            //     message:
            //       "You Are Our Honerable SELLER Please Return To Your Work Space -> E-Cart SellerDashboard",
            //   });
            req.auth = data;
            next();
          }
        }
      );
    }
  } else res.status(401);
});

App.use((req, res, next) => {
  console.log("\n\n\n\n================Middleware===============");
  console.log(req.headers);
  console.log(req.auth);
  console.log("================Middleware ending===============");
  next();
});

// /=========//========//==========//========/ actual requests /=========//=========//========//=========/

App.get("/", async (req, res) => {
  console.log("Get Request On Home");

  const new_products = await Products.find().sort({ createdAt: 1 }).limit(5);
  const sale_products = await Products.find()
    .where("discount")
    .gte(10)
    .sort({ updatedAt: 1 })
    .limit(5);

  const new_prom = new_products.map(async (item) => {
    const url = await getS3Url(item.thumbnail);
    return { ...item._doc, thumbnail: url };
  });
  const sale_prom = sale_products.map(async (item) => {
    const url = await getS3Url(item.thumbnail);
    return { ...item._doc, thumbnail: url };
  });
  const final_new_product = await Promise.all(new_prom);
  const final_sale_product = await Promise.all(sale_prom);
  console.log("Home product  = ", {
    new: final_new_product,
    sale: final_sale_product,
  });

  res.json({
    error: false,
    products: { new: final_new_product, sale: final_sale_product },
  });
});

// ====================== Account Page =========================
App.route("/account")
  .get(async (req, res) => {
    //send details of user,fav product ,recently viewed product,orders
    console.log("Get Request On /Account", req.auth._id);

    const acc_info = await Users.find({ _id: req.auth._id })
      .select(
        "orders favourite recently_viewed name surname gender password email phone payment_dtl address"
      )
      .populate("orders favourite recently_viewed");
    console.log("Account Information = ", acc_info);

    // this condition is for checkin that acc_info promise has resolved so we can perform operation based on it,else undefined error
    if (acc_info.length === 1) {
      console.log("Account Information in if ", acc_info);
      // retriving user's all order with its product and seller details
      const promise = acc_info[0].orders.map(async (item) => {
        // #these
        return await Order.find({ _id: item._doc._id }).populate(
          "product sold_by rating order_completed"
        );
      });
      // resolving promise to get actual data
      let order = await Promise.all(promise); // this return data after all promises (#these) are resolved

      // check for completed order
      const promise2 = order.map(async (item) => {
        // const data =
        return await Ratings.find({
          product: item._id,
          given_by: req.auth._id,
          delivery_status: "delivered",
        });
        // console.log(data);
        // return data.length > 0;
      });
      const order_completed = await Promise.all(promise2);

      // creating object=order that only has order and further writen info. so details of whole product and seller should not need share
      order.forEach((item, index) => {
        order[index] = {
          ...order[index][0]._doc,
          product_name: order[index][0].product.name,
          product_id: order[index][0].product._id,
          seller_name: order[index][0].sold_by.name,
          seller_contact: order[index][0].sold_by.phone,
          order_completed: order[index][0].order_completed,
          order_rating: order[index][0].rating,
          sold_by: "i dont know",
        };
      });

      // getting urls for images
      const addressArr = acc_info[0].address.split(",");
      const favourite_thumbnails = acc_info[0].favourite.map(
        async (item) => await getS3Url(item.thumbnail)
      );
      const orders_thumbnails = acc_info[0].orders.map(
        async (item) => await getS3Url(item.thumbnail)
      );
      const Recently_Viewed_thumbnails = acc_info[0].recently_viewed.map(
        async (item) => await getS3Url(item.thumbnail)
      );
      // resolving all promises of urls
      const thumbnails_favourite = await Promise.all(favourite_thumbnails);
      const thumbnails_recently_viewed = await Promise.all(
        Recently_Viewed_thumbnails
      );
      const thumbnails_orders = await Promise.all(orders_thumbnails);

      //sending rsponce with user data, orders, fav_prd, Rece_viewed_prd, and all image urls
      res.json({
        error: false,
        User: {
          name: acc_info[0].name,
          surname: acc_info[0].surname,
          gender: acc_info[0].gender,
          password: "I_CAnt_tell_you",
          email: acc_info[0].email,
          phone: acc_info[0].phone,
          payment_dtl: acc_info[0].payment_dtl,
          address: {
            house_no: addressArr[0],
            socity: addressArr[1],
            area: addressArr[2],
            city: addressArr[3],
            taluka: addressArr[4],
            district: addressArr[5],
            state: addressArr[6],
            country: addressArr[7],
            pincode: addressArr[8],
          },
        },
        Orders: order,
        Favourites: acc_info[0].favourite,
        Recently_Viewed: acc_info[0].recently_viewed.splice(0, 10),
        thumbnails_favourite,
        thumbnails_orders,
        thumbnails_recently_viewed,
        order_completed,
      });
    }
  })
  .put(async (req, res) => {
    // update details of user
    console.log("Put Request On /Account");

    const item = req.body.User;
    const user = await Users.updateOne(
      { _id: req.auth._id },
      {
        name: item.name,
        surname: item.surname,
        phone: item.phone,
        payment_dtl: item.payment_dtl,
        address: Object.values(item.address).join(","),
      }
    );

    console.log(user);

    if (user.acknowledged === true)
      res.json({
        error: false,
        message: "YOur Profile Details Has Updated Successfully👍",
      });
    else
      res.json({
        error: true,
        message: "Sorry Can Not Update YOur Profile Details",
      });
  })
  .delete(async (req, res) => {
    // cancel order
    // send mail on order cancel
    console.log("Delete Request On /Account", req.query.order_id);

    const up_order = await Order.findOneAndDelete(
      { _id: req.query.order_id },
      { delivery_status: "order_pending" }
    );
    const up_user = await Users.updateOne(
      { _id: up_order.ordered_by },
      { $pull: { orders: up_order._id } }
    );
    const up_seller = await Sellers.updateOne(
      { _id: up_order.sold_by },
      { $pull: { orders: up_order._id } }
    );
    if (up_seller.acknowledged === false && up_user.acknowledged === false)
      res.json({
        error: true,
        message: `Something is Wrong, Order For ${up_order.quantity} Products Can't Cancel`,
      });
    res.json({
      error: false,
      message: `Order For ${
        up_seller.acknowledged && up_user.acknowledged && up_order.quantity
      } Products Has Canceled Sucessfully👍`,
    });
  })
  .patch(async (req, res) => {
    // Set Rating
    console.log(req.body);
    console.log(
      "Give Rating To Ptoduct Patch Request With ",
      req.body.value,
      " Value"
    );
    // const order = await Order.findOne({ _id: req.body.order }, { product: 1 });

    const rate = new Ratings({
      product: req.body.product,
      given_by: req.auth._id,
      given_by_name: `${req.auth.name} ${req.auth.surname}`,
      value: req.body.value,
      review: req.body.review,
    });
    rate.save().then(async (solved, something) => {
      if (solved) {
        const product = await Products.updateOne(
          { _id: req.body.product },
          { $push: { ratings: solved._id } }
        );
        const order = await Order.updateOne(
          { _id: req.body.order_id },
          { rating: solved._id }
        );
        if (product.acknowledged === true && order.acknowledged === true)
          res.json({
            error: false,
            message: "Thank You for Your Honest Review. 😇😃",
          });
        else await Ratings.deleteOne({ _id: solved._id });
      } else
        res.json({
          error: true,
          message: "Can Not Submit Your Review. ",
        });
    });
  });

App.get("/categories", async (req, res) => {
  // res.set("Content-Type", "multipart/form-data");
  console.log("Get Request On /categories");
  // =========== fetch every category iimage and send it======
  const img_names = [
    "ac_cooler_fan",
    "chocolate",
    "cpu",
    "electronic_accessories",
    "fresh_clean",
    "furniture",
    "gadgets",
    "grossary",
    "icecream",
    "kid_accessories",
    "kid_bottoms",
    "kid_footwear",
    "kid_tops_tshirt",
    "kid_toys",
    "kitchen",
    "laptop",
    "men_accessories",
    "men_footwear",
    "men_formals",
    "men_jeans",
    "men_kurtas",
    "men_shirt_tshirt",
    "men_skin_hair_care",
    "mobile",
    "monitor",
    "snacks",
    "spices",
    "tablet",
    "tools",
    "tvs",
    "women_bottom",
    "women_footwear",
    "women_jewellery",
    "women_kurtas",
    "women_makeup",
    "women_purse",
    "women_skin_hair_care",
    "women_tops",
  ];

  const url_obj = {};
  for (let i in img_names) {
    const url = await getS3Url(`category_images/${img_names[i]}.jpg`);
    url_obj[img_names[i]] = url;
  }

  // console.log(url_obj);
  res.json({ error: false, urls: url_obj });
});

// ================ Add / Remove Favourite Products ======================
App.route("/favourite_product/:fpid")
  .post(async (req, res) => {
    // add to fav-product
    console.log("Put Request On /favourite_product", req.params.fpid);

    const isAlready = await Users.find({
      _id: req.auth._id,
      favourite: { $in: req.params.fpid },
    });
    if (isAlready.length === 0) {
      const result = await Users.updateOne(
        { _id: req.auth._id },
        { $push: { favourite: req.params.fpid } }
      );

      if (result.acknowledged)
        res.json({
          error: false,
          message: "This Product Has Added To Favourite Products",
        });
      else
        res.json({
          error: true,
          message: "Can Not Add This Product To Favourite Products",
        });
    } else
      res.json({
        error: false,
        message: "This Product Is Already In Favourite Products",
      });
  })
  .delete(async (req, res) => {
    // remove from fav-product
    console.log("Delete Request On /favourite_product", req.params.fpid);

    const result = await Users.updateOne(
      { _id: req.auth._id },
      { $pull: { favourite: req.params.fpid } }
    );

    if (result.acknowledged)
      res.json({
        error: false,
        message: "Product Has Removed From Favourite Products",
      });
    else
      res.json({
        error: true,
        message: "Product Can Not Remove From Favourite Products",
      });
  });

// ==================== Create Order / Delete Order / Update Order ===================
App.route("/cart_product/:cpid")
  .post(async (req, res) => {
    // add to cart
    console.log("Post Request On /cart_product", req.params.cpid);

    const cart_product_arr = await Products.find({
      _id: req.params.cpid,
    }).populate("owner");
    const cart_product = cart_product_arr[0];

    // order essential values
    const tax =
      cart_product.tax === 0
        ? 0
        : Math.round((cart_product.mrp * cart_product.tax) / 100);
    const discount_total =
      cart_product.discount === 0
        ? 0
        : Math.round((cart_product.mrp * cart_product.discount) / 100);
    const sub_total = cart_product.mrp + tax + cart_product.delivery_charge;
    const total = sub_total - discount_total;
    const thumbnail = cart_product.thumbnail;

    // create order
    const order = new Order({
      product: cart_product._id,
      ordered_by: req.auth._id,
      sold_by: cart_product.owner._id,
      thumbnail: thumbnail,
      size: cart_product.size,
      color: cart_product.color,
      mrp_total: cart_product.mrp,
      tax_total: tax,
      delivery_charge_total: cart_product.delivery_charge,
      sub_total: sub_total,
      discount_total: discount_total,
      total: total,
    });
    //saving order
    const save_order = order.save().then(async function (solve, data) {
      if (solve) {
        // if order created ? then update it to user
        const update_res = await Users.updateOne(
          { _id: req.auth._id },
          { $push: { cart: [solve._id], orders: [solve._id] } }
        );
        if (update_res.acknowledged === true)
          res.json({
            error: false,
            message: "Product Has Added To CART",
          });

        console.log("Order successfully Saved = /cart_product", solve);
        console.log(update_res);
      } else console.log("Error In Saving Order = /cart_product", data);
    });
    console.log(save_order);
  })
  .put(async (req, res) => {
    // update order details
    console.log("Put Request On /cart_product", req.params.cpid);

    const update_res = await Order.updateOne(
      { _id: req.params.cpid },
      { $set: { quantity: req.body.quantity } }
    );

    console.log("Order Update Details ==== ", update_res);
    if (update_res.acknowledged === true)
      res.json({
        error: false,
        message: `CART Product Has Updated To ${req.body.quantity}`,
      });
  })
  .delete(async (req, res) => {
    // remove from cart
    console.log("Delete Request On /cart_product", req.params.cpid);

    const delete_res = await Order.deleteOne({ _id: req.params.cpid });

    const update_res = await Users.updateOne(
      { _id: req.auth._id },
      { $pull: { cart: req.params.cpid, orders: req.params.cpid } }
    );
    console.log(update_res, delete_res);
    if (update_res.acknowledged === true && delete_res.acknowledged === true)
      res.json({
        error: false,
        message: "Product Has Removed From CART",
      });
  });

// ================= Single Product Page ========================
App.route("/product/:poid")
  .get(async (req, res) => {
    console.log("Get Request On Product/", req.params.poid);

    //finding same product
    const item = await Products.find({ _id: req.params.poid }).populate(
      "ratings"
    );
    if (item.length === 1) {
      //after findinng product of color or size which is clicked
      const item2 = await Products.find({
        product_code: item[0]._doc.product_code,
        ...req.query,
      }).populate("ratings");

      // item2[0]["images"]
      const promise = item2[0].images.map(async (url) => {
        return await getS3Url(url, 300);
      });
      const images = await Promise.all(promise);

      console.log(images, typeof images);

      // add to recently viewed
      const rv = await Users.updateOne(
        { _id: req.auth._id },
        {
          $push: {
            recently_viewed: {
              $each: [req.params.poid],
              $position: 0,
            },
          },
        }
      );
      console.log(rv);
      // if product find with clicked size or color send it
      if (item2.length === 1)
        res.json({ ...item2[0]._doc, images: images, error: false });

      // or send the same product
      if (item2.length === 0) res.json({ ...item[0]._doc, error: false });
    }
    console.log(req.query);
  })
  .patch(async (req, res) => {
    // send similar product to this product by comparing tags
    console.log(
      "Patch Request On Product/",
      req.params.poid,
      " - Similar Products",
      req.query
    );

    const item = await Products.find({ _id: req.params.poid });
    if (item.length === 1) {
      // find product of saame product_code
      const item2 = await Products.find({
        $or: [
          { product_code: item[0]._doc.product_code },
          { tags: { $in: item[0]._doc.tags } },
        ],
      }).limit(10);

      const thumbnails = await getS3Url(item2[0].thumbnail);

      //after findinng product of same product_code send it and getting url
      if (item2.length > 0)
        res.json({
          Products: item2,
          thumbnails: thumbnails,
          error: false,
        });
    }
  });

App.post("/products", async (req, res) => {
  // send similar product to this product by comparing tags and category
  let query = req.query;
  if (req.query.tag) {
    query = {
      tags: {
        $in: req.query.tag.split(" "),
      },
    };
    console.log("Post Request On /Products   { tags :", query, " }");
  }
  if (req.query.category) {
    query = { category: { $regex: `^(${query.category})` } };
    console.log();
    console.log("Post Request On /Products", req.query);
  }
  console.log(query);
  let items = await Products.find(query)
    .select(
      "_id size color ratings thumbnail short_description discount mrp name"
    )
    .populate("ratings")
    .limit(24);

  let empty = false;
  if (items.length === 0) {
    items = await Products.find()
      .select(
        "_id size color ratings thumbnail short_description discount mrp name"
      )
      .populate("ratings")
      .limit(24);
    empty = true;
  }

  const promises = items.map(async (item) => {
    const url = await getS3Url(item.thumbnail);
    return { ...item._doc, thumbnail_url: url }; // Use _doc to extract the raw document data
  });
  const updatedItems = await Promise.all(promises);

  res.json({ error: false, empty: empty, Products: updatedItems });
  items = undefined;
});

// encode decode data for saving in browser's cookie securely
App.post("/encode_my_data", (req, res) => {
  console.log("Post Request On /encode_my_data , ", req.body);
  const token = jwt.sign(req.body, process.env.JWT_SECRET_KEY);
  res.json({ error: false, jwt: token });
});
App.post("/decode_my_data", (req, res) => {
  console.log("Post Request On /decode_my_data , ", req.body);
  jwt.verify(req.body.token, process.env.JWT_SECRET_KEY, (err, data) => {
    if (err) res.json({ error: true, message: err.message });
    else res.json({ error: false, data: data });
    console.log("/decode_my_data = ", data);
  });
});

App.post("/feedback", (req, res) => {
  // send email to ecart with feedback text
  console.log("Post Request On /feedback", req.body);
  res.send(`Thank you for your valuable Feedback!`);
});

App.delete("/delete_image", async (req, res) => {
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: "1688037396633_escr.jpg",
  };
  const command = new DeleteObjectCommand(params);
  await S3.send(command);
  // delete this image name from mongodb
  res.send(
    "1688037396633_escr.jpg - is deleted , dont forgot to delete it from server"
  );
});
