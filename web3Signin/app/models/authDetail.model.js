module.exports = mongoose => {
    const AuthDetails = mongoose.model(
      "authdetail",
      mongoose.Schema(
        {
          nonce: {
            type: String,
            required: true
          },
          timestamp: {
            type: Number,
            required: true
          }
        },
        { timestamps: false }
      )
    );
  
    return AuthDetails;
  };
  