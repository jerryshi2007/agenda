using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Agenda.Api.Migrations
{
    /// <inheritdoc />
    public partial class RenameAssignedChildIdToAssignedMemberId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "AssignedChildId",
                table: "Schedules",
                newName: "AssignedMemberId");

            migrationBuilder.RenameIndex(
                name: "IX_Schedules_FamilyId_AssignedChildId",
                table: "Schedules",
                newName: "IX_Schedules_FamilyId_AssignedMemberId");

            migrationBuilder.RenameIndex(
                name: "IX_Schedules_AssignedChildId",
                table: "Schedules",
                newName: "IX_Schedules_AssignedMemberId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "AssignedMemberId",
                table: "Schedules",
                newName: "AssignedChildId");

            migrationBuilder.RenameIndex(
                name: "IX_Schedules_FamilyId_AssignedMemberId",
                table: "Schedules",
                newName: "IX_Schedules_FamilyId_AssignedChildId");

            migrationBuilder.RenameIndex(
                name: "IX_Schedules_AssignedMemberId",
                table: "Schedules",
                newName: "IX_Schedules_AssignedChildId");
        }
    }
}
