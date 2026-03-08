module.exports = {
  datasource: {
    url: process.env.DATABASE_URL || "mysql://root:@127.0.0.1:3306/inventory_pos"
  }
}
