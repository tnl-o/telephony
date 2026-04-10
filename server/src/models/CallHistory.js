'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CallHistory = sequelize.define(
    'CallHistory',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'user_id',
      },
      direction: {
        type: DataTypes.ENUM('incoming', 'outgoing', 'missed'),
        allowNull: false,
      },
      number: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      // Duration in seconds (0 for missed calls)
      duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: 'call_histories',
      underscored: true,
      timestamps: true,
      updatedAt: false,
    }
  );

  CallHistory.associate = (models) => {
    CallHistory.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE',
    });
  };

  return CallHistory;
};
