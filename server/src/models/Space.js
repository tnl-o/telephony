'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Space = sequelize.define(
    'Space',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      extension: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      sipPassword: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'sip_password',
        validate: {
          notEmpty: true,
        },
      },
      pbxWssUrl: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'pbx_wss_url',
        validate: {
          notEmpty: true,
          isWssUrl(value) {
            if (!/^(wss?|https?):\/\//i.test(value)) {
              throw new Error('pbxWssUrl must start with ws://, wss://, http://, or https://');
            }
          },
        },
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    },
    {
      tableName: 'spaces',
      underscored: true,
      timestamps: true,
    }
  );

  Space.associate = (models) => {
    Space.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE',
    });
  };

  return Space;
};
