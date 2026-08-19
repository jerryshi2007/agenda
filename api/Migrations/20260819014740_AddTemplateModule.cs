using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Agenda.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTemplateModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SourceTemplateId",
                table: "Schedules",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Templates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ScheduleType = table.Column<int>(type: "integer", nullable: false),
                    IsPreset = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    FamilyId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    RepeatEndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Location = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Templates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TemplateTimeSlots",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TemplateId = table.Column<Guid>(type: "uuid", nullable: false),
                    DayOfWeek = table.Column<int>(type: "integer", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TemplateTimeSlots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TemplateTimeSlots_Templates_TemplateId",
                        column: x => x.TemplateId,
                        principalTable: "Templates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Schedules_SourceTemplateId",
                table: "Schedules",
                column: "SourceTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_Templates_CreatedBy",
                table: "Templates",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Templates_FamilyId",
                table: "Templates",
                column: "FamilyId");

            migrationBuilder.CreateIndex(
                name: "IX_Templates_FamilyId_Name",
                table: "Templates",
                columns: new[] { "FamilyId", "Name" },
                unique: true,
                filter: "\"IsPreset\" = false AND \"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_Templates_IsPreset",
                table: "Templates",
                column: "IsPreset");

            migrationBuilder.CreateIndex(
                name: "IX_TemplateTimeSlots_TemplateId",
                table: "TemplateTimeSlots",
                column: "TemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_TemplateTimeSlots_TemplateId_DayOfWeek",
                table: "TemplateTimeSlots",
                columns: new[] { "TemplateId", "DayOfWeek" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TemplateTimeSlots");

            migrationBuilder.DropTable(
                name: "Templates");

            migrationBuilder.DropIndex(
                name: "IX_Schedules_SourceTemplateId",
                table: "Schedules");

            migrationBuilder.DropColumn(
                name: "SourceTemplateId",
                table: "Schedules");
        }
    }
}
