import "reflect-metadata";
import app from './app';;



const PORT = process.env.PORT || 5000;

// Connect to database and start the server
// connectDB().then(() => {
//   app.listen(PORT, () => {
//     console.log(`Server running on port http://localhost:${PORT}`);
//   });
// });

app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});