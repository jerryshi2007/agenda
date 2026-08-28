using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Agenda.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFamilyExpansion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ChildName",
                table: "FamilyMembers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DeletedAt",
                table: "FamilyMembers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DisplayMode",
                table: "FamilyMembers",
                type: "integer",
                nullable: false,
                defaultValue: 2);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "FamilyMembers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "CreatorId",
                table: "Families",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "DissolvedAt",
                table: "Families",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "Families",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.CreateTable(
                name: "InvitationCodes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character(6)", fixedLength: true, maxLength: 6, nullable: false),
                    FamilyId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetRole = table.Column<int>(type: "integer", nullable: false),
                    TargetChildName = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    TargetDisplayMode = table.Column<int>(type: "integer", nullable: true),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvitationCodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InvitationCodes_Families_FamilyId",
                        column: x => x.FamilyId,
                        principalTable: "Families",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InvitationCodes_Users_CreatorId",
                        column: x => x.CreatorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Families_CreatorId",
                table: "Families",
                column: "CreatorId");

            migrationBuilder.CreateIndex(
                name: "IX_InvitationCodes_Code",
                table: "InvitationCodes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InvitationCodes_CreatorId",
                table: "InvitationCodes",
                column: "CreatorId");

            migrationBuilder.CreateIndex(
                name: "IX_InvitationCodes_FamilyId",
                table: "InvitationCodes",
                column: "FamilyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InvitationCodes");

            migrationBuilder.DropIndex(
                name: "IX_Families_CreatorId",
                table: "Families");

            migrationBuilder.DropColumn(
                name: "ChildName",
                table: "FamilyMembers");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "FamilyMembers");

            migrationBuilder.DropColumn(
                name: "DisplayMode",
                table: "FamilyMembers");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "FamilyMembers");

            migrationBuilder.DropColumn(
                name: "CreatorId",
                table: "Families");

            migrationBuilder.DropColumn(
                name: "DissolvedAt",
                table: "Families");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Families");
        }
    }
}
