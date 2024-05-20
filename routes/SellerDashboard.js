import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sendMail from "../sendMail.js";
import jwt from "jsonwebtoken";
import Sellers from "../Models/Sellers.js";
import Products from "../Models/Products.js";
import getS3Url from "../getS3Url.js";
// import Order from "../Models/Orders.js";
import Users from "../Models/Users.js";
import Order from "../Models/Orders.js";

const SellerDashboard = new express.Router();

// getting information from .env file
dotenv.config();

// configuring s3 bukket
const S3 = new S3Client({
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
  region: process.env.BUCKET_REGION,
});

const storage = multer.memoryStorage();
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "./uploads");
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${Date.now()}_${file.originalname}`);
//   },
// });
const upload = multer({ storage: storage });

SellerDashboard.use(function userVerificationFunction(req, res, next) {
  console.log("URL Where Client Has Sent Request = ", req.url);
  console.log(
    "Comon Prefix URL From Where Requests Has Received = ",
    req.baseUrl
  );
  console.log("URL From Where Request Has Received = ", req.originalUrl);
  if (req.headers.authorization.split(" ")[0] === "E-Cart") {
    if (req.headers.authorization === "E-Cart this_is_JWT_loaded_by_axios") {
      req.auth = { role: "Geust" };
      next();
    } else {
      jwt.verify(
        req.headers.authorization.split(" ")[1],
        process.env.JWT_SECRET_KEY,
        (err, data) => {
          if (err) {
            console.log(
              "Your Authentication has Failed",
              req.headers.authorization.split(" ")[1]
            );
            res.json({ error: true, message: err.message });
          } else {
            // dont let role === seller access other pages send status code of not allowed
            req.auth = data;
            next();
          }
        }
      );
    }
  }
});

SellerDashboard.use((req, res, next) => {
  console.log("\n\n\n\n================Middleware===============");
  console.log(req.headers);
  console.log(req.auth);
  console.log("================Middleware ending===============\n");
  next();
});

SellerDashboard.get("/", (req, res) => {
  console.log("Get Request On SellerDashboard/");
  res.status(200).send("Get Request On SellerDashboard/");
});

SellerDashboard.post("/login", async (req, res) => {
  console.log("Post Request On /Seller_Dashboard/login");
  console.log(req.body);
  const seller = await Sellers.find()
    .where("email")
    .eq(req.body.email)
    .where("password")
    .eq(req.body.password)
    .select("jwt");
  console.log(seller);
  if (seller.length > 0) {
    // const otp = await sendMail(req.body.email);
    const otp = 123456;
    console.log("OTP = ", otp);
    jwt.verify(seller[0].jwt, process.env.JWT_SECRET_KEY, (err, data) => {
      if (err) {
        console.log(err);
        res.json({ error: true, message: err.message });
      } else {
        res.json({
          error: false,
          otp: otp,
          oid: seller[0]._id,
          jwt: seller[0].jwt,
          data: data,
        });
      }
    });
  } else
    res.json({
      error: true,
      message: "There May Be Wrong Email Or Password, Please Check Again..",
    });
});

SellerDashboard.post("/register", async (req, res) => {
  console.log("Post Request On /Seller_Dashboard/register");
  console.log(req.body);
  const user = await Sellers.find({ email: { $eq: req.body.email } });
  if (user.length === 0) {
    const otp = await sendMail(req.body.email);
    console.log("OTP = ", otp);
    res.json({ error: false, otp: otp });
  } else
    res.json({
      error: true,
      message: "Already Seller Have Having Registered With This Email",
    });
});

SellerDashboard.post("/confirm_user", async (req, res) => {
  console.log("Post Request On /Seller_Dashboard/confirm_user");
  const newSeller = new Sellers({ ...req.body, jwt: "this_is_demo_Token" });
  await newSeller.save().then(() => {
    console.log(
      "\nNew Seller Registeration details saved Succesfully...\n",
      newSeller
    );
  });
  const token = jwt.sign(
    { ...req.body, _id: newSeller._id },
    process.env.JWT_SECRET_KEY
  );
  const updatedSeller = await Sellers.updateOne(
    { _id: newSeller._id },
    { $set: { jwt: token } }
  );
  console.log("Updated Seller : ", updatedSeller);
  res.status(200).json({ error: false, _id: newSeller._id, jwt: token });
});

SellerDashboard.post("/forgot_password", async (req, res) => {
  console.log("Post Request On /SellerDashboard/forgot_password", req.body);
  const seller = await Sellers.find({ email: { $eq: req.body.email } });
  console.log(seller);
  if (seller.length > 0) {
    const otp = await sendMail(req.body.email);
    console.log("OTP = ", otp);
    res.json({ error: false, otp });
  } else
    res.json({
      error: true,
      message: "No Any Seller Exists Having Registered With This Email",
    });
});

SellerDashboard.post("/change_password", async (req, res) => {
  console.log("Post Request On /SellerDashboard/change_password", req.body);
  const seller = await Sellers.find({ email: { $eq: req.body.email } });
  const token = jwt.sign(
    {
      _id: seller[0]._id,
      role: seller[0].role,
      name: seller[0].name,
      surname: seller[0].surname,
      password: req.body.password,
      email: seller[0].email,
      phone: seller[0].phone,
      shop_address: seller[0].shop_address,
      payment_dtl: seller[0].payment_dtl,
      gender: seller[0].gender,
    },
    process.env.JWT_SECRET_KEY
  );
  const updatedSeller = await Sellers.updateOne(
    { email: req.body.email },
    { $set: { password: req.body.password, jwt: token } }
  );
  res.json({
    error: false,
    oid: seller._id,
    jwt: token,
  });
});

SellerDashboard.post("/add_product", upload.any("IMAGES"), async (req, res) => {
  // loging for information purpose
  console.log("============This is product information =========\n");
  console.log(req.body);
  console.log("============This is product Image =========\n");
  console.log(req.files);

  // setting up variables to store names of images to save these in mongodb later for retiriving it again
  let thumbnail_name = "";
  const images_name = [];

  const product_code = Date.now().toString();
  // sending image to s3 bucket
  for (let file of req.files) {
    const filename = `${
      req.auth._id
    }/${product_code}/${Date.now().toString()}_${file.originalname}`;
    // const buffer = await sharp(file.buffer).resize({height:'',width:'',fit:'contain'})
    const params = {
      Bucket: process.env.BUCKET_NAME,
      Key: filename,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    console.log(file.fieldname.slice(0, -2), " | ", filename);

    // =======ATTENTION====== Use pipe and stream to send image to s3============
    // saving naames of file to store it in mongodb
    images_name.push(filename);
    if (file.fieldname.slice(0, -2) !== "images") thumbnail_name = filename;

    // storing images to s3 buket
    const command = new PutObjectCommand(params);
    await S3.send(command);

    // deleting buffer to freeup my memory
    delete file.buffer;
  }

  // Upload product details
  const selling_price =
    req.body.mrp -
    (req.body.discount === 0 ? 0 : (req.body.mrp * req.body.discount) / 100) +
    (req.body.tax_gst === 0 ? 0 : (req.body.mrp * req.body.tax_gst) / 100);

  const tags = req.body.tags.split("#");
  tags.push(product_code);
  const colors = req.body.color.split("#");
  const sizes = req.body.size.split("#");
  for (let i = 0; i < colors.length; i++) {
    for (let j = 0; j < sizes.length; j++) {
      const newPdt = new Products({
        name: req.body.product_name,
        product_code: product_code,
        brand: req.body.brand_name,
        owner: req.auth._id,
        mrp: req.body.mrp,
        discount: req.body.discount,
        sell_price: selling_price,
        quantity: 0,
        long_description: req.body.long_description.split("#"),
        short_description: req.body.short_description,
        thumbnail: thumbnail_name,
        images: images_name,
        size: sizes[j],
        color: colors[i],
        available_size: req.body.size.split("#"),
        available_color: req.body.color.split("#"),
        category: req.body.category,
        tags: tags,
        tax: req.body.tax_gst,
        delivery_charge: req.body.delivery_charge,
      });

      await newPdt.save().then(() => {
        console.log("New Product Saved Sucessfuly : ", colors[i], sizes[j]);
      });
    }
  }

  console.log({ main_image: thumbnail_name, others_image: images_name });
  res.status(200).json({
    error: false,
    main_image: thumbnail_name,
    others_image: images_name,
  });
});

SellerDashboard.route("/my_product/:pid")
  .get(async (req, res) => {
    console.log("Get Request On SellerDashboard/my_product/", req.params.pid);

    await Products.findOne({ _id: req.params.pid })
      .then((item) => {
        console.log(item);
        res.json({
          error: false,
          product_code: item.product_code,
          PRODUCT_NAME: item.name,
          BRAND_NAME: item.brand,
          MRP: item.mrp,
          TAX_GST: item.tax,
          DELIVERY_CHARGE: item.delivery_charge,
          DISCOUNT: item.discount,
          QUANTITY: item.quantity,
          CATEGORY: item.category,
          TAGS: item.tags.join("#"),
          SHORT_DESCRIPTION: item.short_description,
          LONG_DESCRIPTION: item.long_description.join("#"),
          SIZE: item.size,
          COLOR: item.color,
        });
      })
      .catch((err) => {
        res.json({
          error: true,
          message: `${err.message} | Ohh, This Product Doesn't Exists`,
        });
      });
  })
  .put(async (req, res) => {
    console.log("Put Request On SellerDashboard/my_product/", req.params.pid);
    console.log(req.body);
    const item = req.body;

    await Products.updateOne(
      { _id: req.params.pid },
      {
        name: item.PRODUCT_NAME,
        brand: item.BRAND_NAME,
        mrp: item.MRP,
        tax: item.TAX_GST,
        delivery_charge: item.DELIVERY_CHARGE,
        discount: item.DISCOUNT,
        quantity: item.QUANTITY,
        tags: item.TAGS.split("#"),
        short_description: item.SHORT_DESCRIPTION,
        long_description: item.LONG_DESCRIPTION.split("#"),
        size: item.SIZE,
        color: item.COLOR,
      }
    ).then((result) => {
      console.log(result);
      if (result.acknowledged && result.modifiedCount === 1)
        res.json({
          error: false,
          message: "Product Details Updated Successfuly",
        });
      else
        res.json({
          error: true,
          message: "Product Details Are Not Updated",
        });
    });
  })
  .delete(async (req, res) => {
    console.log(
      "Delete Request On SellerDashboard/my_product/",
      req.params.pid
    );

    await Products.deleteOne({ _id: req.params.pid }).then((responce) => {
      if (responce.acknowledged)
        res.json({
          error: false,
          message: "Product Has Deleted Success fully",
        });
      else
        res.json({
          error: true,
          message: "Sorry, This Product Does Not Exists !! ",
        });
    });
  });

SellerDashboard.get("/my_product", async (req, res) => {
  console.log("Get Request On SellerDashboard/my_product");

  await Products.find({ owner: req.auth._id })
    .select(
      "_oid thumbnail name mrp ratings quantity short_description color size"
    )
    .populate("ratings")
    .then(async (products) => {
      if (products.length > 0) {
        const final_products = [];
        products.forEach(async (item, index) => {
          const temp = {};
          let count = 0;
          item.ratings.forEach((rate) => {
            count = count + rate.value;
          });
          temp["_id"] = item._id;
          temp["image"] = await getS3Url(item.thumbnail);
          temp["product_name"] = item.name;
          temp["mrp"] = item.mrp;
          temp["ratings"] = count / item.ratings.length || 0;
          temp["quantity"] = item.quantity;
          temp["short_description"] = item.short_description;
          temp["color"] = item.color;
          temp["size"] = item.size;

          final_products.push(temp);

          if (products.length - 1 === index) {
            console.log(
              "\n=========== final Products =============",
              final_products
            );
            res.json({ error: false, my_products: final_products });
          }
        });
      } else
        res.json({
          error: true,
          message: "You Haven't Registered Any Product on ECART",
        });
    });
});

SellerDashboard.route("/pending_order")
  .get(async (req, res) => {
    console.log("Get Request On SellerDashboard/pending_orders");
    await Sellers.find({ _id: req.auth._id })
      .select("pending_orders")
      .populate("pending_orders")
      .then(async (data) => {
        console.log("Total Pending orders = ", data[0].pending_orders.length);

        if (data.length > 0) {
          const result = [];
          let times = data[0].pending_orders.length;
          data[0].pending_orders.forEach(async (item, index) => {
            // console.log(item)
            const temp = item;
            const thumbnail = await getS3Url(item.thumbnail);

            await Users.findOne({ _id: item.ordered_by })
              .select("name surname phone address")
              .then(async (order_by) => {
                temp.order_by = order_by.name + " " + order_by.surname;
                temp["contact"] = order_by.phone;
                temp["address"] = order_by.address;
                console.log("into ordered_by = ", index);

                await Products.findOne({ _id: item.product })
                  .select("name short_description")
                  .then(async (product) => {
                    console.log("into product = ", index);
                    temp["name"] = product.name;
                    temp["short_description"] = product.short_description;
                    // console.log("\nThumbnail Image = ", temp.thumbnail);

                    // saving brand new info only that is needed
                    result.push({
                      _id: temp._id,
                      thumbnail: thumbnail,
                      name: product.name,
                      short_description: temp.short_description,
                      quantity: temp.quantity,
                      size: temp.size,
                      color: temp.color,
                      total: temp.total,
                      delivery_charge: temp.delivery_charge_total,
                      order_by: temp.order_by,
                      address: temp.address,
                      contact: temp.contact,
                      payment_mode: item.payment_mode,
                      delivery_status: temp.delivery_status,
                    });

                    console.log("times = ", times);
                    // sending responce if This is Last Itteration
                    // if (data[0].pending_orders.length - 1 === index) { //in this condition it executes in last ittretion without checking that any promised has still not resolved (ordered_by and product)
                    if (--times === 0) {
                      //times decreases when it reaches here, decreasing it asyncroniously doesn't matter to count it goes one by one , it becomes true when last promise reaches here
                      await Promise.all(result).then((data) => {
                        console.log(data.length, data);
                        res.json({
                          error: false,
                          pending_orders: data,
                        });
                      });
                    }
                  })
                  .catch((err) => {
                    console.log(err);
                    res.json({
                      error: true,
                      message: err.message,
                    });
                  });
              })
              .catch((err) => {
                console.log(err);
                res.json({
                  error: true,
                  message: err.message,
                });
              });
          });
        } else
          res.json({
            error: true,
            message: "Anyone Didn't have Ordered your Product yet !! 😕",
          });
      });
  })
  .put(async (req, res) => {
    console.log("Put Request On SellerDashboard/pending_orders");
    console.log(req.body.value);
    // inform user and take rattings after order delivered

    const update_order = await Order.updateOne(
      { _id: req.body._id },
      {
        delivery_status: req.body.value,
        order_completed: req.body.value === "delivered" ? true : false,
      }
    );
    console.log(update_order);
    if (req.body.value === "delivered") {
      const update_seller = await Sellers.updateOne(
        { _id: req.auth._id },
        {
          $pull: { pending_orders: req.body._id },
          $push: { completed_orders: req.body._id },
        }
      );
      console.log("updated seller delivered = ", update_seller);
    }
    if (req.body.value === "order_cancel") {
      const update_seller = await Sellers.updateOne(
        { _id: req.auth._id },
        { $pull: { pending_orders: req.body._id } }
      );
      console.log("updated seller  o_cancel= ", update_seller);
    }
    res.status(200).send("Put Request On SellerDashboard/pending_order");
  })
  .delete((req, res) => {
    console.log("Delete Request On SellerDashboard/pending_orders");
    console.log(req.body.value);
    // cancel order
    // send mail on order cancel
    res.status(200).send("Delete Request On SellerDashboard/pending_order");
  });

SellerDashboard.get("/completed_order", async (req, res) => {
  console.log("Get Request On SellerDashboard/complited_orders");
  await Sellers.find({ _id: req.auth._id })
    .select("completed_orders")
    .populate("completed_orders")
    .then((data) => {
      console.log(data[0].completed_orders);

      if (data[0].completed_orders.length > 0) {
        const result = [];
        let times = data[0].completed_orders.length;
        data[0].completed_orders.map(async (item, index) => {
          console.log(index);
          const temp = item;
          const thumbnail = await getS3Url(item.thumbnail);
          const order_by = await Users.find({ _id: item.ordered_by }).select(
            "name surname phone address"
          );
          const product = await Products.find({ _id: item.product }).select(
            "name short_description"
          );
          await Promise.resolve(order_by).then((data2) => {
            console.log("\nOrdered_by of Order = ", data2);
            temp.order_by = data2[0].name + " " + data2[0].surname;
            temp["contact"] = data2[0].phone;
            temp["address"] = data2[0].address;
          });
          await Promise.resolve(product).then((data2) => {
            console.log("\nProducts of Order = ", data2);
            temp["name"] = data2[0].name;
            temp["short_description"] = data2[0].short_description;
          });
          console.log("\nThumbnail Image = ", temp.thumbnail);

          // saving brand new only info that is needed
          result.push({
            thumbnail: thumbnail,
            name: temp.name,
            short_description: temp.short_description,
            quantity: temp.quantity,
            size: temp.size,
            color: temp.color,
            total: temp.total,
            payment_mode: temp.payment_mode,
            order_by: temp.order_by,
            ordered_on: temp.createdAt,
            delivered_on: temp.updatedAt,
            address: temp.address,
            contact: temp.contact,
          });

          // sending responce if This is Last Itteration
          if (--times === 0) {
            console.log("Completed Orders = ", result);
            res.json({ error: false, completed_orders: result });
          }
        });
      } else
        res.json({
          error: true,
          message: "You Haven't Completed Any Order Yet !! 😕",
        });
    });
});

SellerDashboard.get("/sells", (req, res) => {
  console.log("Get Request On SellerDashboard/sells");
  res.status(200).send("Get Request On SellerDashboard/sells");
});

SellerDashboard.route("/account")
  .get(async (req, res) => {
    console.log("Get Request On SellerDashboard/account");

    await Sellers.find({ _id: req.auth._id }).then((data) => {
      console.log(data);
      if (data.length > 0) {
        const addressArr = data[0].shop_address.split(",");
        res.json({
          error: false,
          name: data[0].name,
          surname: data[0].surname,
          password: "I_CAnt_tell_you",
          email: data[0].email,
          phone: data[0].phone,
          payment_dtl: data[0].payment_dtl,
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
        });
      } else
        res.json({
          error: true,
          message: "Sorry Can Not Update YOur Profile Details",
        });
    });
  })
  .put(async (req, res) => {
    console.log("Put Request On SellerDashboard/account");
    console.log(req.body.user);

    const item = req.body.user;
    const user = await Sellers.updateOne(
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
  });

export default SellerDashboard;
