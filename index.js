const express = require("express");
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config() ;
const app = express();
const admin = require("firebase-admin");
const port = process.env.PORT || 5205 ;

const serviceAccount = require("./home-nest-firebase-admin-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


//middleware
app.use(cors());
app.use(express.json());




const logger = (req, res, next) => {
    console.log('logging info')
    next()
}


const verifyFirebaseToken = async (req, res, next) => {

    // console.log('in the verify middleware', req.headers.authorization)

    if(!req.headers.authorization) {
        //do not allow to go
        return res.status(401).send({message: 'unauthorized access'})
    }

    const token = req.headers.authorization.split(' ')[1]

    if(!token) {
        return res.status(401).send({message: 'unauthorized access' })
    }

    // verify token

    try{
       const userInfo = await  admin.auth().verifyIdToken(token) ;
       req.token_email = userInfo.email
    //    console.log('after token verification', userInfo)
         next()
    }
    catch{
        console.log('invalid token')
         return res.status(401).send({message: 'unauthorized access' })
    }

   
}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vm94rma.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/', (req,res) => {
    res.send('smart server is running')
})


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db('home_db')
    const propertiesCollection = db.collection("properties")
    const usersCollection = db.collection("users")
    const reviewsCollection = db.collection("reviews")


     app.get('/users', async (req, res) => {
          const email = req.query.email ;
            const query = {} ;
            if(email){
              query.email  = email
            }
            const cursor = usersCollection.find(query)
            const result = await cursor.toArray() ;
            res.send(result) ;
    })

    app.post('/users', async (req, res) => {
        const newUser = req.body ;
        const email = req.body.email ;
        const query = { email: email } ;
        const existingUser = await usersCollection.findOne(query) ;
        if(existingUser){
            return res.send({message: 'User already exists'}) ;
        } else {
        const result = await usersCollection.insertOne(newUser) ;
        res.send(result) ;
        }
       
    }) 


   app.get("/properties", logger, async (req, res) => {
  try {
    const email = req.query.userEmail; // get email from query
    const sort = req.query.sort || "dateDesc";

    // Build query object
    const query = {};
    if (email) query.userEmail = email; // filter by email if provided

    // Define sort stage dynamically for aggregate
    let sortStage = {};
    if (sort === "dateAsc") sortStage = { createdAtDate: 1 };
    else if (sort === "dateDesc") sortStage = { createdAtDate: -1 };
    else if (sort === "priceHigh") sortStage = { priceNumber: -1 };
    else if (sort === "priceLow") sortStage = { priceNumber: 1 };

    // Use MongoDB aggregation to safely convert data types before sorting
    const result = await propertiesCollection
      .aggregate([
        { $match: query },
        {
          $addFields: {
            // Convert string to proper data type if needed
            priceNumber: { $toDouble: "$price" },
            createdAtDate: { $toDate: "$created_at" },
          },
        },
        { $sort: sortStage },
      ])
      .toArray();

    res.send(result);
  } catch (error) {
    console.error("❌ Error fetching properties:", error);
    res.status(500).send({ message: "Failed to fetch properties." });
  }
});




app.get('/latest-properties', async (req, res) => {
        const cursor = propertiesCollection.find().sort({created_at: -1}).limit(6) ;
        const result = await cursor.toArray() ;
        res.send(result)
    })


       app.get('/properties/:id', logger, verifyFirebaseToken, async (req, res) => {
  const id = req.params.id;
  const email = req.query.email; // ✅ optional, only check if provided
  const query = { _id: new ObjectId(id) };

  if (email) {
    // ✅ Only allow if the token email matches the query email
    if (email !== req.token_email) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    query.email = email;
  }
    const result = await propertiesCollection.findOne(query);
    res.send(result);
  
});


    app.post('/properties', verifyFirebaseToken, async (req, res) => {
        const newProperty = req.body ;
        const result = await propertiesCollection.insertOne(newProperty) ;
        res.send(result)
    })

      app.patch('/properties/:id', verifyFirebaseToken, async (req, res) => {
    const id = req.params.id;
    const updatedProduct = req.body;
    const query = { _id: new ObjectId(id) };
    const update = { $set: updatedProduct };
    const result = await propertiesCollection.updateOne(query, update);
    res.send(result);
});



    app.delete('/properties/:id', verifyFirebaseToken, async (req, res) => {
        const id = req.params.id ;
        const query = {_id: new ObjectId(id) } 
        const result = await propertiesCollection.deleteOne(query) ;
        res.send(result)
    })



 app.get('/reviews', verifyFirebaseToken, async (req, res) => {
  const email = req.query.email;          // optional, filter by reviewer
  const propertyId = req.query.propertyId; // optional, filter by property
  const query = {};

  // Filter by reviewer email if provided
  if (email) {
    if (email !== req.token_email) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    query.reviewerEmail = email;
  }

  // Filter by property ID if provided
  if (propertyId) {
    query.propertyId = propertyId;
  }

  const cursor = reviewsCollection.find(query);
  const result = await cursor.toArray();
  res.send(result);
});

app.post('/reviews', verifyFirebaseToken, async (req, res) => {
  try {
    const newReview = req.body;
    const result = await reviewsCollection.insertOne(newReview);
    res.status(201).send(result);
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).send({ message: "Failed to add review" });
  }
});


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
   
  }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`Smart server is running on port ${port}`)
})




//Mongo Db user && Password
// homeNestUser
// CQ7aLYAyxe9TgGEf