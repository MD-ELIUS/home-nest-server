const express = require("express");
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
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


    app.get('/properties', logger, verifyFirebaseToken, async (req, res) => {   
          const cursor = propertiesCollection.find().sort({created_at: -1})
          const result = await cursor.toArray() ;
          res.send(result) ;
    }) ;

    app.post('/properties', async (req, res) => {
        const newProperty = req.body ;
        const result = await propertiesCollection.insertOne(newProperty) ;
        res.send(result)
    })


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