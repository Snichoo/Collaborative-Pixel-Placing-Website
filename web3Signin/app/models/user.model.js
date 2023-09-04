module.exports = mongoose => {
    const User = mongoose.model(
      "user",
      mongoose.Schema(
        {
          address: {
            type: String,
            required: true,
            unique: true
          },
          authdetails: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "authdetail"
          }
        },
        { timestamps: false }
      )
    );
  
    return User;
  };
  