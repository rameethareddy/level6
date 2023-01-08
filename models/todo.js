/* eslint-disable no-unused-vars */
"use strict";
const { Model } = require("sequelize");
const { Op } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Todo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Todo.belongsTo(models.User, {
        foreignKey: "userId",
      });
    }

    static addTodo({ title, dueDate, userId }) {
      return this.create({
        title: title,
        dueDate: dueDate,
        completed: false,
        userId,
      });
    }

    async setCompletionStatus({ completionStatus }) {
      return await this.update({ completed: completionStatus });
    }

    static async listTodos() {
      return await this.findAll();
    }

    deleteATodo() {
      this.destroy();
    }

    static async remove(id, userId) {
      return this.destroy({
        where: {
          id,
          userId,
        },
      });
    }

    static async overDue(userId) {
      return await this.findAll({
        where: {
          dueDate: {
            [Op.lt]: new Date(),
          },
          userId,
          completed: false,
        },
      });
    }

    static async dueToday(userId) {
      return await this.findAll({
        where: {
          dueDate: {
            [Op.eq]: new Date(),
          },
          userId,
          completed: false,
        },
      });
    }
    static async dueLater(userId) {
      return await this.findAll({
        where: {
          dueDate: {
            [Op.gt]: new Date(),
          },
          userId,
          completed: false,
        },
      });
    }

    static async completedItems(userId) {
      return await this.findAll({
        where: {
          completed: true,
          userId,
        },
      });
    }
  }
  Todo.init(
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          validateTitleLength: function (value) {
            if (value == null || value.length < 5) {
              throw new Error("Title must be at least 5 characters long");
            }
          },
        },
      },
      dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          notNull: {
            msg: "Due date cannot be null",
          },
          isDate: {
            msg: "Due date must be a valid date",
          },
          isInRange: function (date) {
            date = new Date(date);
            let yearBefore = new Date(
              new Date().setFullYear(new Date().getFullYear() - 1)
            );
            let yearAfter = new Date(
              new Date().setFullYear(new Date().getFullYear() + 1)
            );
            if (yearBefore > date || yearAfter < date) {
              throw new Error("Due date must be within 1 Year of today");
            }
          },
        },
      },
      completed: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Todo",
    }
  );
  return Todo;
};
