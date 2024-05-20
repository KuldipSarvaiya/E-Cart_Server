import express from "express";
import OrderSummary from "../Models/OrderSummary.js";
import { Stripe } from "stripe";
import Products from "../Models/Products.js";
import Users from "../Models/Users.js";
import Order from "../Models/Orders.js";
import getS3Url from "../getS3Url.js";
import Sellers from "../Models/Sellers.js";
import jwt from 'jsonwebtoken';

const Cart = new express.Router();

Cart.use(function userVerificationFunction(req, res, next) {
  console.log("URL Where Client Has Sent Request = ", req.url);
  console.log(
    "Comon Prefix URL From Where Requests Has Received = ",
    req.baseUrl
  );
  console.log("URL From Where Request Has Received = ", req.originalUrl);
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


Cart.get("/cart_product", async (req, res) => {
  console.log("Get Request On /cart/cart_product");

  const cart = await Order.find({
    ordered_by: req.auth._id,
    delivery_status: "none",
  }).populate("product");

  if (cart.length > 0) {
    const promise = cart.map(async (item, index) => {
      cart[index] = {
        ...item._doc,
        name: item._doc.product.name,
        short_description: item._doc.product.short_description,
        ratings: item._doc.product.ratings,
        p_id: item._doc.product._id,
        product: undefined,
      };
      return await getS3Url(item.thumbnail);
    });
    const urls = await Promise.all(promise);

    cart.forEach((item, index) => {
      cart[index]["thumbnail"] = urls[index];
    });

    res.json({
      error: false,
      cart_product: cart,
    });
    console.log(cart);
  } else {
    res.json({
      error: true,
      cart_product: [],
      message: "No Product Has Found In Your Cart",
    });
  }
});

Cart.get("/order_summary", async (req, res) => {
  console.log("Get Request On /Cart/order_summary");

  const order = await Order.find({ ordered_by: req.auth._id });
  console.log(order);

  let orders = [];
  let grand_mrp = 0;
  let grand_tax = 0;
  let grand_delivery_charge = 0;
  let grand_subtotal = 0;
  let grand_discount = 0;
  let grand_total = 0;

  order.forEach((order_item) => {
    orders.push(order_item._id);
    grand_mrp += parseInt(order_item.mrp_total);
    grand_tax += parseInt(order_item.tax_total);
    grand_delivery_charge += parseInt(order_item.delivery_charge_total);
    grand_subtotal += parseInt(order_item.sub_total);
    grand_discount += parseInt(order_item.discount_total);
    grand_total += parseInt(order_item.total);
  });

  const order_summary = new OrderSummary({
    orders,
    grand_mrp,
    grand_tax,
    grand_delivery_charge,
    grand_subtotal,
    grand_discount,
    grand_total,
  });
  // saving order Summary
  await order_summary.save().then(async (saved, opt) => {
    if (saved) {
      console.log("Order Summary Created ", saved);

      {
        // delete Old Order Summary
        const delete_old_res = await Users.findOne(
          { _id: req.auth._id },
          { orders_summary: true }
        );
        const delete_summary = await OrderSummary.deleteOne({
          _id: delete_old_res.orders_summary,
        });
        console.log(
          "Old Order Summary Deleted = ",
          delete_summary,
          delete_old_res
        );
      }

      // updating order summary of user
      const update_res = await Users.updateOne(
        { _id: req.auth._id },
        { $set: { orders_summary: saved._id } }
      );
      console.log("Order Summary Added To User = ", update_res);
      if (update_res.acknowledged === true)
        res.json({
          error: false,
          address: {
            house_no: "25",
            socity: "radhe-krishna row-house",
            area: "aside Signet mall, kamrej-gam road",
            city: "kamrej",
            taluka: "kamrej",
            district: "surat",
            state: "gujarat",
            country: "india",
            pincode: "394185",
          },
          orders_summary: {
            grand_mrp,
            grand_tax,
            grand_delivery_charge,
            grand_subtotal,
            grand_discount,
            grand_total,
          },
        });
    } else {
      res.json({ error: true, message: "Order Summary Not SAved" });
      console.log("order summary not saved .... ", opt);
    }
  });
});

Cart.get("/payment_details", async (req, res) => {
  console.log("Get Request On /Cart/payment_details ======= \n\n", req.body);

  const order = await Order.find({ ordered_by: req.auth._id }).populate(
    "product"
  );

  const qtyErr = [];
  order.forEach(async (item) => {
    if (item.quantity > item.product.quantity) {
      // listing of not available order items
      qtyErr.push({
        name: item.product.name,
        size: item.product.size,
        color: item.product.color,
        available_quantity: item.product.quantity,
      });
      return { quantity: -1 };
    }
  });

  if (qtyErr.length > 0)
    res.json({
      error: true,
      message: "NoQTY",
      not_available_orders: qtyErr,
    });
  else res.json({ error: false });
});

Cart.get("/place_order", async (req, res) => {
  console.log("Post Request On /Cart/place_order", req.body);

  try {
    const order = await Order.find({ ordered_by: req.auth._id }).populate(
      "product"
    );

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    let success_url = "http://localhost:3000/cart/success?orders=";
    let cancel_url = "http://localhost:3000/cart/failed?orders=";
    const line_item = order.map(async (item) => {
      if (item.quantity <= item.product.quantity) {
        // listing of available order items
        success_url += `${item._id}&`;
        cancel_url += `${item._id}&`;
        const prod_qty = await Products.updateOne(
          { _id: item.product._id },
          { $inc: { quantity: -item.quantity } }
        );
        if (prod_qty.acknowledged)
          console.log(
            "Quantity Updated of = ",
            item.product.name,
            "  ",
            item._id,
            " by ",
            item.quantity
          );
      } else return { quantity: -1 };

      // setting item for payment
      const product = await stripe.products.create({
        default_price_data: {
          unit_amount: Math.ceil(item.total / item.quantity) * 100,
          currency: "inr",
        },
        expand: ["default_price"],
        name:
          item.product.name +
          `${item.product.size !== "N/A" ? "/" + item.product.size : ""}` +
          `${item.product.color !== "N/A" ? "/" + item.product.color : ""}`,
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.ceil(item.total / item.quantity) * 100,
        currency: "inr",
      });

      return {
        quantity: item.quantity,
        price: price.id,
      };
    });

    console.log(line_item);
    const line_item_final = await Promise.all(line_item);
    console.log([...line_item_final].filter((item) => item.quantity != -1));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [...line_item_final].filter((item) => item.quantity != -1),
      success_url: success_url,
      cancel_url: cancel_url,
      phone_number_collection: {
        enabled: true,
      },
    });

    console.log(session);

    res.json({ error: false, url: session.url });
  } catch (error) {
    res.json({ error: true, message: error });
  }
});

Cart.put("/payment_success", async (req, res) => {
  console.log("Put Request on /cart/payment_success");
  console.log(req.body);

  try {
    const orders = await Order.find({ _id: { $in: req.body.orders } }).select(
      "sold_by ordered_by"
    );
    console.log(orders);

    orders.forEach(async (item) => {
      const ord = await Order.updateOne(
        { _id: item._id },
        { $set: { delivery_status: "order_pending" } }
      );
      console.log("Order Updated = ", ord);

      const slr = await Sellers.updateOne(
        { _id: item.sold_by },
        { $push: { pending_orders: item._id } }
      );
      console.log("seller Updated = ", slr);

      const usr = await Users.updateOne(
        { _id: item.ordered_by },
        { $push: { orders: item._id }, $pull: { cart: item._id } }
      );
      console.log("user Updated = ", usr);
    });

    res.send("Order Placed Successfully 🥳👍");
  } catch (error) {
    res.send(error);
  }
});

Cart.put("/payment_failed", async (req, res) => {
  console.log("Put Request on /cart/payment_failed");
  console.log(req.body);
  try {
    const orders = await Order.find({ _id: { $in: req.body.orders } }).select(
      "quantity product"
    );

    orders.forEach(async (item) => {
      const rewind = await Products.updateOne(
        { _id: item.product },
        { $set: { $inc: { quantity: item.quantity } } }
      );
      console.log(rewind);
    });

    res.send("Order Is Considered As Cancelled");
  } catch (error) {
    res.send(error);
  }
});

export default Cart;
